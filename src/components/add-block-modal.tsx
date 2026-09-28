import { useState } from "react";
import {
  Check,
  CirclePlus,
  Compass,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import type { GraphBlockConfig } from "../lib/orchestration/protocol";
import { CATALOG_ADDITIONAL_BLOCKS, useRunStore } from "../store/run-store";

interface AddBlockModalProps {
  onClose: () => void;
}

export default function AddBlockModal({ onClose }: AddBlockModalProps) {
  const { blocks, addBlock } = useRunStore();
  const [tab, setTab] = useState<"catalog" | "custom">("catalog");

  // Custom block form state
  const [customName, setCustomName] = useState("Custom Convective Neural Core");
  const [customShort, setCustomShort] = useState("NEURAL-2");
  const [customCategory, setCustomCategory] =
    useState<GraphBlockConfig["category"]>("model");
  const [customColor, setCustomColor] = useState("#38bdf8");
  const [customResolution, setCustomResolution] = useState("2km");
  const [customLatency, setCustomLatency] = useState(350);
  const [customBias, setCustomBias] =
    useState<GraphBlockConfig["biasMethod"]>("kalman_bias");
  const [customDescription, setCustomDescription] = useState(
    "High-resolution boundary layer neural network with local radar integration",
  );

  const availableCatalog = CATALOG_ADDITIONAL_BLOCKS.filter(
    (item) => !blocks.some((b) => b.id === item.id),
  );

  const handleAddCatalogItem = (block: GraphBlockConfig) => {
    addBlock(block);
    onClose();
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const id = `custom_${Date.now()}`;
    const newBlock: GraphBlockConfig = {
      id,
      name: customName,
      short: customShort,
      category: customCategory,
      color: customColor,
      description: customDescription,
      resolution: customResolution,
      latencyMs: Number(customLatency),
      biasMethod: customBias,
      enabled: true,
      userAdded: true,
    };
    addBlock(newBlock);
    onClose();
  };

  return (
    <div className="config-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="add-block-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="config-modal-header">
          <div className="config-header-left">
            <span className="config-node-badge" style={{ background: "#7590ff", color: "#0b111e" }}>
              <CirclePlus size={16} />
            </span>
            <div>
              <h3>Expand Agent Graph</h3>
              <p className="config-subtitle">
                Add operational atmospheric solvers, data streams, and intermediate transformation filters
              </p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close modal">
            <X size={17} />
          </button>
        </div>

        <div className="add-block-tabs">
          <button
            className={tab === "catalog" ? "active" : ""}
            onClick={() => setTab("catalog")}
          >
            <Compass size={14} />
            Operational Block Catalog ({availableCatalog.length} available)
          </button>
          <button
            className={tab === "custom" ? "active" : ""}
            onClick={() => setTab("custom")}
          >
            <Plus size={14} />
            Author Custom Meteorological Node
          </button>
        </div>

        <div className="config-modal-body">
          {tab === "catalog" ? (
            <div className="catalog-grid">
              {availableCatalog.length === 0 ? (
                <div className="catalog-empty">
                  <Sparkles size={24} />
                  <p>All catalog blocks are currently integrated into the graph.</p>
                  <span>Switch to "Author Custom Meteorological Node" to create specialized models.</span>
                </div>
              ) : (
                availableCatalog.map((item) => (
                  <div
                    key={item.id}
                    className="catalog-card"
                    style={{ "--card-color": item.color } as React.CSSProperties}
                  >
                    <div className="catalog-card-header">
                      <span className="catalog-badge" style={{ background: item.color }}>
                        {item.short}
                      </span>
                      <span className="catalog-category">{item.category.toUpperCase()}</span>
                    </div>
                    <h4>{item.name}</h4>
                    <p className="catalog-desc">{item.description}</p>
                    <div className="catalog-specs">
                      <span>dx: {item.resolution}</span>
                      <span>{item.latencyMs}ms</span>
                      <span>{item.biasMethod.replace("_", " ")}</span>
                    </div>
                    <button
                      className="button primary-button add-catalog-cta"
                      onClick={() => handleAddCatalogItem(item)}
                    >
                      <Plus size={13} />
                      Integrate into Graph
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <form onSubmit={handleAddCustom} className="custom-block-form">
              <div className="config-grid">
                <label className="config-field">
                  <span>Model / Block Title</span>
                  <input
                    type="text"
                    required
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                  />
                </label>

                <label className="config-field">
                  <span>Callsign / Short Code</span>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={customShort}
                    onChange={(e) => setCustomShort(e.target.value)}
                  />
                </label>

                <label className="config-field">
                  <span>Block Classification</span>
                  <select
                    value={customCategory}
                    onChange={(e) =>
                      setCustomCategory(
                        e.target.value as GraphBlockConfig["category"],
                      )
                    }
                  >
                    <option value="model">Atmospheric Predictive Solver (Agent Core)</option>
                    <option value="transform">Intermediate Downscaler / Filter (Transform Tool)</option>
                    <option value="tool">Dedicated Atmospheric Utility (Tool)</option>
                    <option value="input">Telemetry / Observation Terminal (Input Origin)</option>
                  </select>
                </label>

                <label className="config-field">
                  <span>Theme Accent Color</span>
                  <div className="color-picker-row">
                    {["#38bdf8", "#f472b6", "#34d399", "#fbbf24", "#c084fc", "#f97316"].map(
                      (c) => (
                        <button
                          key={c}
                          type="button"
                          className={`color-dot ${customColor === c ? "selected" : ""}`}
                          style={{ background: c }}
                          onClick={() => setCustomColor(c)}
                        />
                      ),
                    )}
                  </div>
                </label>

                <label className="config-field">
                  <span>Grid Resolution (dx)</span>
                  <select
                    value={customResolution}
                    onChange={(e) => setCustomResolution(e.target.value)}
                  >
                    <option value="1km">1km (Hyper-Local Scale)</option>
                    <option value="2km">2km (Mesoscale Nest)</option>
                    <option value="4km">4km (Convective Permitting)</option>
                    <option value="10km">10km (Regional Scale)</option>
                    <option value="25km">25km (Synoptic Scale)</option>
                  </select>
                </label>

                <label className="config-field">
                  <span>Calibration Algorithm</span>
                  <select
                    value={customBias}
                    onChange={(e) =>
                      setCustomBias(e.target.value as GraphBlockConfig["biasMethod"])
                    }
                  >
                    <option value="kalman_bias">Kalman Innovation Filter</option>
                    <option value="quantile_mapping">Quantile Mapping</option>
                    <option value="linear_decay">Exponential Linear Decay</option>
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
                    value={customLatency}
                    onChange={(e) => setCustomLatency(Number(e.target.value))}
                  />
                </label>

                <label className="config-field full-width">
                  <span>Scientific Description & Rationale</span>
                  <input
                    type="text"
                    required
                    value={customDescription}
                    onChange={(e) => setCustomDescription(e.target.value)}
                  />
                </label>
              </div>

              <div className="custom-form-actions">
                <button type="button" className="button" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="button primary-button">
                  <Check size={14} />
                  Deploy Custom Node to Graph
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
