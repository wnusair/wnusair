import { onMount } from "solid-js";
import * as d3 from "d3";
import worldData from "../lib/world.json";
import { SITE } from "../site-config";

type Props = {
  isStatic?: boolean;
  class?: string;
  enableHover?: boolean;
};

const GlobeComponent = ({ isStatic, class: className, enableHover }: Props) => {
  let mapContainer: HTMLDivElement | undefined;

  const visitedCountries = SITE.visitedCountries;

  onMount(() => {
    if (!mapContainer) return;

    const width = mapContainer.clientWidth;
    const height = 500;
    const sensitivity = 75;

    let projection = d3
      .geoOrthographic()
      .scale(250)
      .center([0, 0])
      .rotate([0, -30])
      .translate([width / 2, height / 2]);

    const initialScale = projection.scale();
    let pathGenerator = d3.geoPath().projection(projection);

    let svg = d3
      .select(mapContainer)
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    svg
      .append("circle")
      .attr("fill", "#EEE")
      .attr("stroke", "#000")
      .attr("stroke-width", "0.2")
      .attr("cx", width / 2)
      .attr("cy", height / 2)
      .attr("r", initialScale);

    let map = svg.append("g");

    const paths = map
      .append("g")
      .attr("class", "countries")
      .selectAll("path")
      .data(worldData.features)
      .enter()
      .append("path")
      .attr("d", (d: any) => pathGenerator(d as any))
      .style("fill", (d: { properties: { name: string } }) => {
        return visitedCountries.includes(d.properties.name)
          ? "var(--primary-500)"
          : "white";
      })
      .style("stroke", "black")
      .style("stroke-width", 0.3)
      .style("opacity", 0.8);

    if (enableHover) {
      const tooltip = d3.select("body")
        .append("div")
        .attr("class", "globe-tooltip")
        .style("position", "absolute")
        .style("background", "rgba(0, 0, 0, 0.8)")
        .style("color", "white")
        .style("padding", "8px 12px")
        .style("border-radius", "4px")
        .style("font-size", "14px")
        .style("pointer-events", "none")
        .style("opacity", 0)
        .style("z-index", 1000);

      paths
        .style("cursor", "pointer")
        .on("mouseover", function(event, d: any) {
          const data = d as { properties: { name: string } };
          const isVisited = visitedCountries.includes(data.properties.name);
          const element = d3.select(this);
          
          if (!isVisited) {
            element.style("fill", "var(--primary-200)");
          }
          element
            .style("opacity", 1)
            .style("stroke-width", 0.5);

          tooltip
            .html(data.properties.name)
            .style("opacity", 1)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px");
        })
        .on("mousemove", function(event) {
          tooltip
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function(event, d: any) {
          const data = d as { properties: { name: string } };
          const isVisited = visitedCountries.includes(data.properties.name);
          const element = d3.select(this);
          
          if (!isVisited) {
            element.style("fill", "white");
          }
          element
            .style("opacity", 0.8)
            .style("stroke-width", 0.3);

          tooltip.style("opacity", 0);
        });
    }

    const coords = [];
    for (let i = 0; i <= 50; i++) {
      const t = i / 50;
      const lon = -125 + t * 50;
      const lat = 12 * Math.pow(t - 0.5, 2) + 35;
      coords.push([lon, lat]);
    }

    const homeCurveGeo = {
      type: "LineString",
      coordinates: coords
    };

    const textPath = map.append("path")
      .datum(homeCurveGeo)
      .attr("id", "home-curve")
      .attr("d", (d: any) => pathGenerator(d as any))
      .style("fill", "none")
      .style("stroke", "none");

    const homeText = map.append("text")
      .style("font-size", "28px")
      .style("font-weight", "900")
      .style("fill", "black")
      .style("pointer-events", "none");
      
    homeText.append("textPath")
      .attr("href", "#home-curve")
      .attr("startOffset", "50%")
      .style("text-anchor", "middle")
      .text("Home");

    let isPaused = false;
    let isDragging = false;
    let previousMousePosition: [number, number] | null = null;

    const updatePaths = () => {
      svg.selectAll(".countries path").attr("d", (d: any) => pathGenerator(d as any));
      
      textPath.attr("d", (d: any) => pathGenerator(d as any));
      
      const rotate = projection.rotate();
      const centerCoord: [number, number] = [-rotate[0], -rotate[1]];
      const dist = d3.geoDistance(centerCoord, [-100, 35]);
      
      const maxDist = Math.PI / 2; // Horizon
      const fadeStart = maxDist - 0.7; // Start fading ~40 degrees from the edge
      
      if (dist > maxDist) {
        homeText.style("opacity", 0);
        homeText.style("display", "none");
      } else {
        homeText.style("display", "block");
        if (dist > fadeStart) {
          const ratio = Math.max(0, 1 - (dist - fadeStart) / (maxDist - fadeStart));
          homeText.style("opacity", ratio * ratio); // ease out opacity
          homeText.style("font-size", `${14 + 14 * ratio}px`); // shrink font
        } else {
          homeText.style("opacity", 1);
          homeText.style("font-size", "28px");
        }
      }
    };

    if (enableHover) {
      svg
        .on("mouseenter", function() {
          isPaused = true;
        })
        .on("mouseleave", function() {
          isPaused = false;
        })
        .call(d3.drag<SVGSVGElement, unknown>()
          .on("start", function(event) {
            isDragging = true;
            isPaused = true;
            previousMousePosition = [event.x, event.y];
          })
          .on("drag", function(event) {
            if (previousMousePosition) {
              const rotate = projection.rotate();
              const dx = event.x - previousMousePosition[0];
              const dy = event.y - previousMousePosition[1];
              const k = sensitivity / projection.scale();
              projection.rotate([
                rotate[0] + dx * k,
                Math.max(-90, Math.min(90, rotate[1] - dy * k))
              ]);
              previousMousePosition = [event.x, event.y];
              updatePaths();
            }
          })
          .on("end", function() {
            isDragging = false;
            previousMousePosition = null;
          }));
    }

    d3.timer(() => {
      if (!isPaused && !isStatic) {
        const rotate = projection.rotate();
        const k = sensitivity / projection.scale();
        projection.rotate([rotate[0] - 1 * k, rotate[1]]);
        updatePaths();
      }
    }, 200);
  });

  return (
    <div class="flex flex-col text-white justify-center items-center w-full h-full">
      <div
        class="w-full h-full flex justify-center items-center"
        ref={mapContainer}
      ></div>
      {enableHover && (
        <p class="text-sm text-darkslate-300 mt-4 text-center">
          Click and drag to rotate
        </p>
      )}
    </div>
  );
};

export default GlobeComponent;
