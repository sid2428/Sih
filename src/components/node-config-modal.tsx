import { useState } from "react";
import {
  Check,
  Cpu,
  Sliders,
  Trash2,
  X,
} from "lucide-react";
import type { GraphBlockConfig } from "../lib/orchestration/protocol";
import { useRunStore } from "../store/run-store";

interface NodeConfigModalProps {
  block: GraphBlockConfig;
  onClose: () => void;
}

export default function NodeConfigModal({ block, onClose }: NodeConfigModalProps) {
  const { updateBlockConfig, removeBlock, toggleBlock } = useRunStore();

  const [name, setName] = useState(block.name);
  const [short, setShort] = useState(block.short);
  const [resolution, setResolution] = useState(block.resolution);
  const [latencyMs, setLatencyMs] = useState(block.latencyMs);
  const [biasMethod, setBiasMethod] = useState(block.biasMethod);
  const [memberCount, setMemberCount] = useState(block.memberCount || 51);
  const [minWeight, setMinWeight] = useState(
    block.minWeight !== undefined ? Math.round(block.minWeight * 100) : 0,
  );
  const [maxWeight, setMaxWeight] = useState(
    block.maxWeight !== undefined ? Math.round(block.maxWeight * 100) : 100,
  );

  const handleSave = () => {
    updateBlockConfig(block.id, {
      name,
      short,
      resolution,
      latencyMs: Number(latencyMs),
      biasMethod,
      memberCount: block.category === "model" ? Number(memberCount) : undefined,
      minWeight: minWeight / 100,
      maxWeight: maxWeight / 100,
    });
    onClose();
  };

  const isCore =
    block.id === "nwp" ||
    block.id === "ensemble" ||
    block.id === "ai" ||
    block.id === "blend" ||
    block.id === "output";

  return (
    <div className="config-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="config-modal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ "--accent-color": block.color } as React.CSSProperties}
      >
        <div className="config-modal-header">
          <div className="config-header-left">
            <span
              className="config-node-badge"
              style={{ background: block.color, color: "#0b111e" }}
            >
              {block.short}
            </span>
            <div>
              <h3>Configure Block: {block.name}</h3>
              <p className="config-subtitle">
                Category: <b>{block.category.toUpperCase()}</b> · ID:{" "}
                <span className="mono">{block.id}</span>
              </p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close modal">
            <X size={17} />
          </button>
        </div>

        <div className="config-modal-body">
          {/* Active status toggle */}
          <div className="config-field toggle-field">
            <div>
              <strong>Node Online Status</strong>
              <p>When disabled, consensus engine dynamically reallocates weights</p>
            </div>
            <label className="switch-label">
              <input
                type="checkbox"
                checked={block.enabled}
                onChange={() => toggleBlock(block.id)}
              />
              <span className="switch-slider" />
            </label>
          </div>

          <div className="config-grid">
            <label className="config-field">
              <span>Display Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label className="config-field">
              <span>Callsign / Short Tag</span>
              <input
                type="text"
                value={short}
                maxLength={10}
                onChange={(e) => setShort(e.target.value)}
              />
            </label>

            <label className="config-field">
              <span>Horizontal Grid Resolution (dx)</span>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
              >
                <option value="1km">1km (Convective Scale Nest)</option>
                <option value="3km">3km (Regional Mesoscale)</option>
                <option value="4km">4km (Operational UM / WRF)</option>
                <option value="9km">9km (ECMWF HRES Global)</option>
                <option value="12km">12km (Global Ensemble Core)</option>
                <option value="25km">25km (ERA5 Synoptic Reanalysis)</option>
                <option value="Adaptive">Adaptive Resolution</option>
              </select>
            </label>

            <label className="config-field">
              <span>Bias Correction & Calibration</span>
              <select
                value={biasMethod}
                onChange={(e) =>
                  setBiasMethod(e.target.value as GraphBlockConfig["biasMethod"])
                }
              >
                <option value="quantile_mapping">Quantile Mapping (CDF Transfer)</option>
                <option value="kalman_bias">Kalman Innovation Filter</option>
                <option value="linear_decay">Exponential Decay Linear Calibration</option>
                <option value="orographic_elevation">SRTM Orographic Lapse-Rate</option>
              </select>
            </label>

            <label className="config-field">
              <span>Execution Latency (ms)</span>
              <input
                type="number"
                min="50"
                max="2000"
                step="50"
                value={latencyMs}
                onChange={(e) => setLatencyMs(Number(e.target.value))}
              />
            </label>

            {block.category === "model" && (
              <label className="config-field">
                <span>Stochastic Member Count</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={memberCount}
                  onChange={(e) => setMemberCount(Number(e.target.value))}
                />
              </label>
            )}
          </div>

          {block.category === "model" && (
            <div className="config-weight-clamp">
              <h4>
                <Sliders size={14} /> Dynamic Weight Bounds
              </h4>
              <p>Clamp the minimum and maximum allowable consensus allocation</p>
              <div className="weight-sliders">
                <label>
                  Min Weight ({minWeight}%):
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={minWeight}
                    onChange={(e) => setMinWeight(Number(e.target.value))}
                  />
                </label>
                <label>
                  Max Weight ({maxWeight}%):
                  <input
                    type="range"
                    min="50"
                    max="100"
                    value={maxWeight}
                    onChange={(e) => setMaxWeight(Number(e.target.value))}
                  />
                </label>
              </div>
            </div>
          )}

          <div className="config-scientific-notes">
            <Cpu size={14} />
            <span>
              Configuring scientific parameters directly influences covariance
              matrices, downscaling resolution, and Kalman innovation updates.
            </span>
          </div>
        </div>

        <div className="config-modal-footer">
          {!isCore && (
            <button
              className="button danger-button"
              onClick={() => {
                removeBlock(block.id);
                onClose();
              }}
            >
              <Trash2 size={14} />
              Remove Block
            </button>
          )}
          <div className="footer-actions">
            <button className="button" onClick={onClose}>
              Cancel
            </button>
            <button className="button primary-button" onClick={handleSave}>
              <Check size={14} />
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
