import { SOURCES } from "../data/mock-profile";
import type { Forecast } from "../types/forecast";
export default function FlatPipeline({ forecast }: { forecast: Forecast }) {
  return (
    <div data-testid="pipeline-fallback">
      <svg
        className="flat-pipeline"
        viewBox="0 0 640 240"
        role="img"
        aria-label="Three forecast sources combine into adaptive guidance"
      >
        <g fill="none">
          {forecast.sources.map((source, i) => (
            <g key={source.id}>
              <path
                d={`M128 ${45 + i * 75} C230 ${45 + i * 75},240 120,338 120`}
                stroke={SOURCES[i].color}
                strokeWidth={1 + source.weight * 8}
                opacity={source.available ? 0.8 : 0.15}
              />
              <circle
                cx="100"
                cy={45 + i * 75}
                r="23"
                stroke={SOURCES[i].color}
              />
              <text
                x="100"
                y={44 + i * 75}
                fill={SOURCES[i].color}
                textAnchor="middle"
                fontSize="9"
              >
                {SOURCES[i].short}
              </text>
              <text
                x="100"
                y={56 + i * 75}
                fill="#c2cee4"
                textAnchor="middle"
                fontSize="8"
              >
                {(source.weight * 100).toFixed(0)}%
              </text>
            </g>
          ))}
          <circle cx="367" cy="120" r="28" stroke="#b5c3ff" strokeWidth="2" />
          <path
            d="M354 129 367 105 380 129M359 121h17"
            stroke="#b5c3ff"
            strokeWidth="2"
          />
          <path d="M397 120H535" stroke="#b5c3ff" strokeWidth="3" />
          <rect x="536" y="98" width="45" height="45" rx="8" stroke="#c3cfff" />
          <text
            x="367"
            y="173"
            textAnchor="middle"
            fill="#abb5cc"
            fontSize="11"
          >
            Adaptive blend
          </text>
          <text
            x="559"
            y="173"
            textAnchor="middle"
            fill="#abb5cc"
            fontSize="11"
          >
            Forecast
          </text>
        </g>
      </svg>
    </div>
  );
}
