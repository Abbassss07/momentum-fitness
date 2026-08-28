"use client";

import type { ChartPoint } from "@/lib/fitness";
import { formatDate } from "@/lib/fitness";

type ProgressChartProps = {
  points: ChartPoint[];
  unit?: string;
  emptyLabel?: string;
};

export function ProgressChart({
  points,
  unit = "kg",
  emptyLabel = "Your progress will appear here after the first entry.",
}: ProgressChartProps) {
  if (!points.length) {
    return (
      <div className="chart-empty">
        <p>{emptyLabel}</p>
      </div>
    );
  }

  const values = points.map((point) => Number(point.value));
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const naturalSpread = maxValue - minValue;
  const padding = Math.max(naturalSpread * 0.2, maxValue * 0.025, 1);
  const chartMin = Math.max(0, minValue - padding);
  const chartMax = maxValue + padding;
  const width = 760;
  const height = 250;
  const paddingLeft = 50;
  const paddingRight = 14;
  const paddingTop = 16;
  const paddingBottom = 18;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const coordinates = points.map((point, index) => {
    const x =
      points.length === 1
        ? paddingLeft + plotWidth / 2
        : paddingLeft + (index / (points.length - 1)) * plotWidth;
    const y =
      paddingTop +
      (1 - (Number(point.value) - chartMin) / (chartMax - chartMin)) *
        plotHeight;
    return { ...point, x, y };
  });

  const line = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const gridRows = [0, 1, 2, 3];
  const middlePoint = points[Math.floor((points.length - 1) / 2)];

  return (
    <div className="chart-wrap">
      <svg
        className="progress-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Progress from ${points[0].value} to ${points.at(-1)?.value} ${unit}`}
      >
        {gridRows.map((row) => {
          const y = paddingTop + (row / (gridRows.length - 1)) * plotHeight;
          const value = chartMax - (row / (gridRows.length - 1)) * (chartMax - chartMin);
          return (
            <g key={row}>
              <line
                x1={paddingLeft}
                x2={width - paddingRight}
                y1={y}
                y2={y}
                className="chart-grid-line"
              />
              <text x={paddingLeft - 10} y={y + 3} className="chart-y-label">
                {formatAxisValue(value)}
              </text>
            </g>
          );
        })}

        <polyline
          points={line}
          fill="none"
          className="chart-line"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {coordinates.map((point, index) => {
          const showPoint = coordinates.length <= 16 || index === coordinates.length - 1;
          if (!showPoint) return null;
          return (
            <circle
              key={`${point.date}-${point.value}-${index}`}
              cx={point.x}
              cy={point.y}
              r={index === coordinates.length - 1 ? 4 : 3}
              className="chart-point"
            >
              <title>{`${formatDate(point.date)}: ${point.value} ${unit}`}</title>
            </circle>
          );
        })}
      </svg>

      <div className="chart-axis" aria-hidden="true">
        <span>{formatDate(points[0].date, true)}</span>
        {points.length > 2 ? <span>{formatDate(middlePoint.date, true)}</span> : null}
        {points.length > 1 ? <span>{formatDate(points.at(-1)!.date, true)}</span> : null}
      </div>
    </div>
  );
}

function formatAxisValue(value: number) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: value < 10 ? 1 : 0,
  }).format(value);
}

