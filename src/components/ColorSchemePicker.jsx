import { useRef, useState, useEffect } from "react";
import { ChevronDown, Check, Palette } from "lucide-react";
import { APP_COLOR_SCHEMES } from "../data/appColorSchemes";

export function ColorSchemePicker({ value, onChange, label = "App colour schemes", className = "" }) {
  const [open, setOpen] = useState(false);
  const detailsRef = useRef(null);
  const selected = APP_COLOR_SCHEMES.find((s) => s.id === value) || APP_COLOR_SCHEMES[0];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (detailsRef.current && !detailsRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`color-scheme-picker ${className}`} ref={detailsRef}>
      <button
        type="button"
        className="color-scheme-trigger"
        onClick={() => setOpen(!open)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <ChevronDown size={16} className={`color-scheme-chevron ${open ? "open" : ""}`} />
        <div className="color-scheme-value">
          <div className="color-scheme-info">
            <strong className="color-scheme-label">{selected.label}</strong>
            <small className="color-scheme-note">{selected.note}</small>
          </div>
        </div>
        <div className="color-scheme-swatches" aria-hidden="true">
          {selected.colors.map((color) => (
            <i key={color} style={{ backgroundColor: color }} />
          ))}
        </div>
      </button>

      {open && (
        <div className="color-scheme-options" role="listbox" aria-label={label}>
          {APP_COLOR_SCHEMES.map((scheme) => (
            <button
              key={scheme.id}
              type="button"
              role="option"
              aria-selected={scheme.id === value}
              className={`color-scheme-option ${scheme.id === value ? "selected" : ""}`}
              onClick={() => {
                onChange?.(scheme.id);
                setOpen(false);
              }}
            >
              <div className="color-scheme-info">
                <strong className="color-scheme-label">{scheme.label}</strong>
                <small className="color-scheme-note">{scheme.note}</small>
              </div>
              <div className="color-scheme-swatches" aria-hidden="true">
                {scheme.colors.map((color) => (
                  <i key={color} style={{ backgroundColor: color }} />
                ))}
              </div>
              {scheme.id === value && <Check size={16} className="color-scheme-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}