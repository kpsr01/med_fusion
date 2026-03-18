(function () {
  'use strict';

  const root = document.getElementById('networkGraph');
  let network = null;

  function destroyNetwork() {
    if (network) {
      network.destroy();
      network = null;
    }
  }

  function scoreValue(n) {
    const value = Number(n);
    return Number.isFinite(value) ? value : 0;
  }

  function buildGraph(payload) {
    const query = payload && payload.query ? payload.query : {};
    const results = payload && payload.results ? payload.results : {};
    const associations = results.genomicAssociations && Array.isArray(results.genomicAssociations.associations)
      ? results.genomicAssociations.associations.slice(0, 10)
      : [];
    const therapeutics = Array.isArray(results.therapeutics) ? results.therapeutics.slice(0, 12) : [];

    const diseaseName = query.disease || 'Unknown disease';
    const nodes = [];
    const edges = [];

    nodes.push({
      id: 'disease',
      label: diseaseName,
      group: 'disease',
      shape: 'dot',
      size: 34,
      font: { color: '#ffe7ec', size: 18, face: 'JetBrains Mono' },
      color: { background: '#ff6f88', border: '#ff9aad' },
      title: `Disease node: ${diseaseName}`,
    });

    associations.forEach((assoc) => {
      const symbol = assoc.geneSymbol || assoc.targetId;
      if (!symbol) return;
      const score = scoreValue(assoc.overallScore);
      const scorePct = Math.round(score * 100);
      const nodeId = `gene:${symbol}`;

      nodes.push({
        id: nodeId,
        label: symbol,
        group: 'gene',
        shape: 'dot',
        size: 14 + score * 22,
        font: { color: '#d8ebff', face: 'JetBrains Mono' },
        color: { background: '#5fb8ff', border: '#95d1ff' },
        title: `${symbol} - score ${scorePct}%`,
      });

      edges.push({
        from: 'disease',
        to: nodeId,
        label: `${scorePct}%`,
        color: { color: 'rgba(95, 184, 255, 0.65)' },
        width: 1 + score * 3,
        smooth: { type: 'dynamic' },
      });
    });

    therapeutics.forEach((drug, index) => {
      const name = drug.name || `Drug ${index + 1}`;
      const nodeId = `drug:${name}`;
      nodes.push({
        id: nodeId,
        label: name,
        group: 'drug',
        shape: 'box',
        borderWidth: 1,
        margin: 8,
        font: { color: '#e8fff5', face: 'JetBrains Mono', size: 12 },
        color: { background: '#35d6a7', border: '#7ff0ce' },
        title: `${name} (PubChem)`,
      });

      if (associations.length) {
        const linkedGene = associations[index % associations.length];
        const symbol = linkedGene && (linkedGene.geneSymbol || linkedGene.targetId);
        if (symbol) {
          edges.push({
            from: `gene:${symbol}`,
            to: nodeId,
            dashes: true,
            width: 1.2,
            color: { color: 'rgba(53, 214, 167, 0.5)' },
            label: 'implied',
            font: { size: 9, color: '#8ee2c7', face: 'JetBrains Mono' },
          });
        } else {
          edges.push({
            from: 'disease',
            to: nodeId,
            dashes: true,
            width: 1,
            color: { color: 'rgba(53, 214, 167, 0.5)' },
            label: 'candidate',
            font: { size: 9, color: '#8ee2c7', face: 'JetBrains Mono' },
          });
        }
      }
    });

    return { nodes, edges };
  }

  function render(payload) {
    if (!root) return;
    destroyNetwork();

    if (!window.vis || !window.vis.Network || !window.vis.DataSet) {
      root.innerHTML = '';
      return;
    }

    const graph = buildGraph(payload);
    if (graph.nodes.length <= 1) {
      root.innerHTML = '';
      return;
    }

    root.innerHTML = `
      <article class="card">
        <div class="card__header">
          <h2>Gene-Drug-Disease Network</h2>
          <span class="badge badge--source">Open Targets + PubChem</span>
        </div>
        <div class="card__body">
          <div id="networkCanvas" class="network-canvas" aria-label="Gene drug disease network graph" role="img"></div>
        </div>
      </article>
    `;

    const container = document.getElementById('networkCanvas');
    if (!container) return;

    network = new window.vis.Network(
      container,
      {
        nodes: new window.vis.DataSet(graph.nodes),
        edges: new window.vis.DataSet(graph.edges),
      },
      {
        autoResize: true,
        interaction: {
          hover: true,
          tooltipDelay: 120,
          dragNodes: true,
        },
        physics: {
          enabled: true,
          barnesHut: {
            gravitationalConstant: -4500,
            centralGravity: 0.17,
            springLength: 135,
            springConstant: 0.035,
            damping: 0.12,
          },
          stabilization: { iterations: 180 },
        },
        edges: {
          smooth: true,
          font: { align: 'middle' },
        },
      }
    );

    network.on('click', (params) => {
      if (!params.nodes || !params.nodes.length) return;
      const nodeId = params.nodes[0];
      if (typeof nodeId !== 'string') return;

      if (nodeId.startsWith('gene:')) {
        const symbol = nodeId.slice('gene:'.length);
        window.dispatchEvent(new CustomEvent('network:focus-gene', { detail: { symbol } }));
        return;
      }

      if (nodeId.startsWith('drug:')) {
        const name = nodeId.slice('drug:'.length);
        window.dispatchEvent(new CustomEvent('network:focus-drug', { detail: { name } }));
      }
    });
  }

  function init() {
    if (!root) return;

    window.addEventListener('search:start', () => {
      destroyNetwork();
      root.innerHTML = '';
    });

    window.addEventListener('search:complete', (event) => {
      const payload = event && event.detail ? event.detail.data : null;
      render(payload);
    });
  }

  window.NetworkGraphModule = {
    init,
  };
})();
