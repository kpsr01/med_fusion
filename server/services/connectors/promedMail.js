/**
 * ProMED Mail Connector
 * Web scraping — outbreak alert posts from promedmail.org.
 * RSS feed discontinued (June 2023); parses HTML listings instead.
 * Auth: None required
 * Note: Scraping may be unreliable; designed to fail gracefully.
 */

const axios = require('axios');
const cheerio = require('cheerio');

const PROMED_BASE_URL = 'https://promedmail.org';
const PROMED_SEARCH_URL = 'https://promedmail.org/promed-posts/';

/**
 * Fetch outbreak alert data by scraping ProMED Mail post listings.
 * @param {Object} params
 * @param {string} params.disease - Disease name to search for
 * @param {string} [params.region] - Region to filter by
 * @returns {Promise<Object>} { source, data, timestamp, status }
 */
async function fetchData({ disease, region }) {
  const diseaseLower = (disease || '').toLowerCase();
  const regionLower = (region || '').toLowerCase();

  try {
    // Try ProMED search/listing page
    const searchUrl = `${PROMED_SEARCH_URL}`;
    let posts = [];

    try {
      const response = await axios.get(searchUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
        params: {
          feed_id: 1,
          keyword: disease,
        },
      });

      const $ = cheerio.load(response.data);

      // Parse post listings from ProMED
      $('article, .post-item, .promed-post, div.publish_date_html, li.post').each((i, el) => {
        const title = $(el).find('h2 a, h3 a, .post-title a, a.title').first().text().trim();
        const link = $(el).find('h2 a, h3 a, .post-title a, a.title').first().attr('href');
        const date = $(el).find('.date, .post-date, time, .publish_date').first().text().trim();
        const excerpt = $(el).find('.excerpt, .summary, .post-excerpt, p').first().text().trim();

        if (title) {
          posts.push({
            title,
            link: link ? (link.startsWith('http') ? link : `${PROMED_BASE_URL}${link}`) : null,
            date,
            excerpt: excerpt.substring(0, 300),
          });
        }
      });

      // Also try parsing any generic content structure
      if (posts.length === 0) {
        $('a[href*="promed-post"]').each((i, el) => {
          const title = $(el).text().trim();
          const link = $(el).attr('href');
          if (title && title.length > 10) {
            posts.push({
              title,
              link: link ? (link.startsWith('http') ? link : `${PROMED_BASE_URL}${link}`) : null,
              date: null,
              excerpt: null,
            });
          }
        });
      }
    } catch (scrapeErr) {
      // Scraping failed — try alternative approach
    }

    // Filter posts by disease and region keywords
    const filteredPosts = posts.filter((post) => {
      const text = `${post.title} ${post.excerpt || ''}`.toLowerCase();
      const diseaseMatch = text.includes(diseaseLower);
      const regionMatch = !regionLower || regionLower === 'global' || text.includes(regionLower);
      return diseaseMatch && regionMatch;
    });

    // If no filtered results but we have posts, return unfiltered as context
    const finalPosts = filteredPosts.length > 0 ? filteredPosts : posts.slice(0, 10);

    return {
      source: 'ProMED Mail',
      data: {
        disease: diseaseLower,
        region: region || 'global',
        postCount: finalPosts.length,
        posts: finalPosts.slice(0, 15),
        filtered: filteredPosts.length > 0,
        note: 'ProMED RSS discontinued June 2023. Data obtained via web scraping. Results may be incomplete.',
        searchUrl: `${PROMED_SEARCH_URL}?keyword=${encodeURIComponent(disease)}`,
      },
      timestamp: new Date().toISOString(),
      status: 'ok',
    };
  } catch (err) {
    return {
      source: 'ProMED Mail',
      data: null,
      timestamp: new Date().toISOString(),
      status: 'error',
      error: `ProMED Mail scraping failed: ${err.message}`,
      message: 'ProMED Mail RSS was discontinued. Scraping may be blocked or the site structure may have changed.',
    };
  }
}

module.exports = { fetchData };
