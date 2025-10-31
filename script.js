// ============================================================
// ENDPOINT DATI (freeCodeCamp)
// ============================================================
const EDUCATION_URL =
    "https://cdn.freecodecamp.org/testable-projects-fcc/data/choropleth_map/for_user_education.json";
const COUNTIES_URL =
    "https://cdn.freecodecamp.org/testable-projects-fcc/data/choropleth_map/counties.json";

document.addEventListener("DOMContentLoaded", () => {
    // ==========================================================
    // 1) GESTIONE TEMA (stesso pattern della tua heatmap)
    // ==========================================================
    const themeToggle = document.getElementById("theme-toggle");
    const body = document.body;

    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
        body.dataset.theme = savedTheme;
        themeToggle.textContent = savedTheme === "dark" ? "☀️" : "🌙";
    } else {
        const prefersDark = window.matchMedia(
            "(prefers-color-scheme: dark)"
        ).matches;
        body.dataset.theme = prefersDark ? "dark" : "light";
        themeToggle.textContent = prefersDark ? "☀️" : "🌙";
    }

    function toggleTheme() {
        const isDark = body.dataset.theme === "dark";
        body.dataset.theme = isDark ? "light" : "dark";
        localStorage.setItem("theme", body.dataset.theme);
        themeToggle.textContent = isDark ? "🌙" : "☀️";
    }

    themeToggle.addEventListener("click", toggleTheme);
    themeToggle.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") toggleTheme();
    });

    // ==========================================================
    // 2) SETUP SVG / MISURE
    // ==========================================================
    const svg = d3.select("#chart");
    const width = 960;
    const height = 610;

    svg
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

    const tooltip = d3.select("#tooltip");
    const container = document.getElementById("container");

    // ==========================================================
    // 3) FETCH PARALLELO DEI DUE DATASET
    // ==========================================================
    Promise.all([d3.json(COUNTIES_URL), d3.json(EDUCATION_URL)]).then(
        ([us, education]) => {
            // mappa FIPS -> dato education
            const educationByFips = new Map(
                education.map((d) => [d.fips, d])
            );

            // valori min/max di education per la scala
            const eduValues = education.map((d) => d.bachelorsOrHigher);
            const eduMin = d3.min(eduValues);
            const eduMax = d3.max(eduValues);

            const colorRange = [
                "#dbeafe",
                "#93c5fd",
                "#3b82f6",
                "#1d4ed8",
                "#1e3a8a",
            ];

            // scala quantize su % di laureati
            const colorScale = d3
                .scaleQuantize()
                .domain([eduMin, eduMax])
                .range(colorRange);

            // --------------------------------------------------------
            // DISEGNO CONTEE
            // --------------------------------------------------------
            const counties = topojson.feature(us, us.objects.counties).features;
            const path = d3.geoPath();

            const countyPaths = svg
                .append("g")
                .selectAll("path")
                .data(counties)
                .enter()
                .append("path")
                .attr("class", "county")
                .attr("d", path)
                .attr("data-fips", (d) => d.id)
                .attr("data-education", (d) => {
                    const edu = educationByFips.get(d.id);
                    return edu ? edu.bachelorsOrHigher : 0;
                })
                .attr("fill", (d) => {
                    const edu = educationByFips.get(d.id);
                    return edu ? colorScale(edu.bachelorsOrHigher) : "#ccc";
                })
                .on("mouseover", function (event, d) {
                    const edu = educationByFips.get(d.id);
                    if (!edu) return;

                    tooltip
                        .style("opacity", 1)
                        .attr("data-education", edu.bachelorsOrHigher)
                        .html(`
        <strong>${edu.area_name}, ${edu.state}</strong>
        <br/>Laureati: ${edu.bachelorsOrHigher}%
        <br/>FIPS: ${edu.fips}
      `);

                    const box = container.getBoundingClientRect();
                    const ttNode = tooltip.node();
                    const ttBox = ttNode.getBoundingClientRect();

                    let left = event.clientX - box.left + 15;
                    let top = event.clientY - box.top - ttBox.height - 10;

                    if (top < 0) {
                        top = event.clientY - box.top + 12;
                    }

                    const padding = 8;
                    if (left < padding) left = padding;
                    if (left + ttBox.width > box.width - padding) {
                        left = box.width - ttBox.width - padding;
                    }

                    tooltip.style("left", left + "px").style("top", top + "px");
                })
                .on("mousemove", function (event) {
                    const box = container.getBoundingClientRect();
                    const ttNode = tooltip.node();
                    const ttBox = ttNode.getBoundingClientRect();

                    let left = event.clientX - box.left + 15;
                    let top = event.clientY - box.top - ttBox.height - 10;

                    if (top < 0) {
                        top = event.clientY - box.top + 12;
                    }

                    const padding = 8;
                    if (left < padding) left = padding;
                    if (left + ttBox.width > box.width - padding) {
                        left = box.width - ttBox.width - padding;
                    }

                    tooltip.style("left", left + "px").style("top", top + "px");
                })
                .on("mouseout", hideTooltip)
                .on("mouseleave", hideTooltip);

            function hideTooltip() {
                tooltip
                    .style("opacity", 0)
                    .attr("data-education", null);
            }

            // nascondi anche se esco dall'SVG
            svg.on("mouseleave", () => {
                tooltip
                    .style("opacity", 0)
                    .attr("data-education", null);
            });
            // --------------------------------------------------------
            // DISEGNO BORDI STATI (facilita lettura)
            // --------------------------------------------------------
            const states = topojson.mesh(us, us.objects.states, (a, b) => a !== b);
            svg
                .append("path")
                .datum(states)
                .attr("class", "state-boundary")
                .attr("d", path);

            // --------------------------------------------------------
            // LEGENDA
            // --------------------------------------------------------
            drawLegend(colorScale, colorRange, eduMin, eduMax);
            window.addEventListener("resize", () => {
                drawLegend(colorScale, colorRange, eduMin, eduMax);
            });
        }
    );
});

// ============================================================
// FUNZIONE LEGENDA RESPONSIVE (come l’altra app)
// ============================================================
function drawLegend(colorScale, colorRange, min, max) {
    // selezioniamo direttamente lo SVG con id="legend"
    const legendSvg = d3.select("#legend");

    // puliamo tutto (serve anche per il resize)
    legendSvg.selectAll("*").remove();

    // larghezza reale dello svg
    const legendBox = legendSvg.node().getBoundingClientRect();
    const legendWidth = legendBox.width || 500;
    const legendHeight = 50;

    const legendRectSize = 35;
    const legendGap = 10;

    const itemWidth = legendRectSize + legendGap;
    const legendContentWidth =
        colorRange.length * itemWidth - legendGap;

    // centro il gruppo dentro lo svg
    const offsetX = (legendWidth - legendContentWidth) / 2;

    const thresholds =
        colorScale.thresholds && colorScale.thresholds().length
            ? colorScale.thresholds()
            : d3.range(min, max, (max - min) / colorRange.length);

    // titolo
    legendSvg
        .append("text")
        .attr("x", legendWidth / 2)
        .attr("y", 11)
        .attr("fill", "currentColor")
        .attr("font-size", "11px")
        .attr("font-weight", "500")
        .attr("text-anchor", "middle")
        .text("Percentuale laureati (%)");

    // rettangoli colorati 
    legendSvg
        .selectAll("rect")
        .data(colorRange)
        .enter()
        .append("rect")
        .attr("x", (d, i) => offsetX + i * itemWidth)
        .attr("y", 18)
        .attr("width", legendRectSize)
        .attr("height", 12)
        .attr("fill", (d) => d);

    // etichette sotto
    legendSvg
        .selectAll("text.legend-label")
        .data(colorRange)
        .enter()
        .append("text")
        .attr("class", "legend-label")
        .attr("x", (d, i) => offsetX + i * itemWidth + legendRectSize / 2)
        .attr("y", 38)
        .attr("fill", "currentColor")
        .attr("font-size", "8px")
        .attr("text-anchor", "middle")
        .text((d, i) => {
            const from = i === 0 ? min : thresholds[i - 1];
            const to = thresholds[i];
            if (to) return `${from.toFixed(1)}–${to.toFixed(1)}`;
            return `≥${from.toFixed(1)}`;
        });
}
