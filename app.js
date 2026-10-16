const DATA_URL = 'data/glucose.json';
const REFRESH_INTERVAL = 20 * 60 * 1000;
const chartStatus = document.querySelector('#chart-status');
const chartSummary = document.querySelector('#chart-summary');
const refreshButton = document.querySelector('#refresh-button');
const chart = d3.select('#glucose-chart');
let currentReadings = [];

function setStatus(message) {
  chartStatus.textContent = message;
}

function parseReading(entry) {
  const date = new Date(entry.date);
  const value = Number(entry.sgv);
  return Number.isFinite(value) && !Number.isNaN(date.valueOf()) ? { date, value } : null;
}

async function loadReadings() {
  const response = await fetch(DATA_URL, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Glucose data failed (${response.status}).`);
  const payload = await response.json();
  const readings = (payload.readings ?? [])
    .map(parseReading)
    .filter(Boolean)
    .sort((a, b) => a.date - b.date)
    .slice(-100);
  if (!readings.length) throw new Error('No readable glucose records were found.');
  return readings;
}

function renderChart(readings) {
  const width = Math.max(chart.node().parentElement.clientWidth, 280);
  const height = 330;
  const margin = { top: 16, right: 16, bottom: 36, left: 42 };
  const x = d3.scaleTime().domain(d3.extent(readings, d => d.date)).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear()
    .domain([Math.max(40, d3.min(readings, d => d.value) - 20), d3.max(readings, d => d.value) + 20])
    .nice()
    .range([height - margin.bottom, margin.top]);
  chart.attr('viewBox', `0 0 ${width} ${height}`);
  chart.selectAll('*').remove();
  chart.append('g').attr('class', 'grid').attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(5).tickSize(-(width - margin.left - margin.right)).tickFormat(''));
  chart.append('g').attr('class', 'axis').attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(Math.min(5, readings.length)).tickFormat(d3.timeFormat('%b %-d')));
  chart.append('g').attr('class', 'axis').attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(5));
  const line = d3.line().x(d => x(d.date)).y(d => y(d.value)).curve(d3.curveMonotoneX);
  chart.append('path').datum(readings).attr('class', 'glucose-line').attr('d', line);
  chart.append('g').selectAll('circle').data(readings).join('circle')
    .attr('class', 'glucose-point').attr('cx', d => x(d.date)).attr('cy', d => y(d.value)).attr('r', 3)
    .append('title').text(d => `${d3.timeFormat('%b %-d, %H:%M')(d.date)}: ${d.value} mg/dL`);
  const latest = readings.at(-1);
  chartSummary.textContent = `Latest reading: ${latest.value} mg/dL at ${latest.date.toLocaleString()} · Range: ${d3.min(readings, d => d.value)}–${d3.max(readings, d => d.value)} mg/dL.`;
}

async function refreshChart() {
  refreshButton.disabled = true;
  setStatus('Loading glucose data…');
  try {
    currentReadings = await loadReadings();
    renderChart(currentReadings);
    setStatus(`Showing ${currentReadings.length} readings.`);
  } catch (error) {
    currentReadings = [];
    chart.selectAll('*').remove();
    chartSummary.textContent = '';
    setStatus(`Unable to load glucose data: ${error.message}`);
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener('click', refreshChart);
window.addEventListener('resize', () => {
  if (currentReadings.length) renderChart(currentReadings);
});
refreshChart();
window.setInterval(refreshChart, REFRESH_INTERVAL);
