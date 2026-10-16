const DATA_URL = 'https://glucose-proxy.e-sancheztovar27.workers.dev';
const REFRESH_INTERVAL = 5 * 60 * 1000;
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

const TARGET_MIN = 70;
const TARGET_MAX = 140;

function renderChart(readings) {
  const width = Math.max(chart.node().parentElement.clientWidth, 280);
  const height = 330;
  const margin = { top: 16, right: 16, bottom: 36, left: 42 };
  const dataMin = d3.min(readings, d => d.value);
  const dataMax = d3.max(readings, d => d.value);
  const yMin = Math.max(40, Math.min(TARGET_MIN - 15, dataMin - 15));
  const yMax = Math.max(TARGET_MAX + 15, dataMax + 15);

  const x = d3.scaleTime().domain(d3.extent(readings, d => d.date)).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear()
    .domain([yMin, yMax])
    .nice()
    .range([height - margin.bottom, margin.top]);

  chart.attr('viewBox', `0 0 ${width} ${height}`);
  chart.selectAll('*').remove();

  // Grid
  chart.append('g').attr('class', 'grid').attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(5).tickSize(-(width - margin.left - margin.right)).tickFormat(''));

  // Target range band (70 - 140 mg/dL)
  const targetTop = y(TARGET_MAX);
  const targetBottom = y(TARGET_MIN);
  chart.append('rect')
    .attr('class', 'target-band')
    .attr('x', margin.left)
    .attr('y', targetTop)
    .attr('width', width - margin.left - margin.right)
    .attr('height', Math.max(0, targetBottom - targetTop));

  chart.append('line')
    .attr('class', 'target-boundary')
    .attr('x1', margin.left)
    .attr('x2', width - margin.right)
    .attr('y1', targetTop)
    .attr('y2', targetTop);

  chart.append('line')
    .attr('class', 'target-boundary')
    .attr('x1', margin.left)
    .attr('x2', width - margin.right)
    .attr('y1', targetBottom)
    .attr('y2', targetBottom);

  chart.append('text')
    .attr('class', 'target-label')
    .attr('x', width - margin.right - 8)
    .attr('y', targetTop + 13)
    .text('Target: 70–140 mg/dL');

  // Axes: Clock-time on x-axis
  chart.append('g').attr('class', 'axis').attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(Math.min(6, readings.length)).tickFormat(d3.timeFormat('%-I:%M %p')));
  chart.append('g').attr('class', 'axis').attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(5));

  // Glucose line and data points
  const line = d3.line().x(d => x(d.date)).y(d => y(d.value)).curve(d3.curveMonotoneX);
  chart.append('path').datum(readings).attr('class', 'glucose-line').attr('d', line);
  chart.append('g').selectAll('circle').data(readings).join('circle')
    .attr('class', 'glucose-point')
    .classed('in-range', d => d.value >= TARGET_MIN && d.value <= TARGET_MAX)
    .attr('cx', d => x(d.date)).attr('cy', d => y(d.value)).attr('r', 3)
    .append('title').text(d => `${d3.timeFormat('%b %-d, %-I:%M %p')(d.date)}: ${d.value} mg/dL`);

  const latest = readings.at(-1);
  const inRangeCount = readings.filter(d => d.value >= TARGET_MIN && d.value <= TARGET_MAX).length;
  const tir = Math.round((inRangeCount / readings.length) * 100);
  chartSummary.textContent = `Latest reading: ${latest.value} mg/dL at ${latest.date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · In target (70–140 mg/dL): ${tir}% · 8h Range: ${dataMin}–${dataMax} mg/dL.`;
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
