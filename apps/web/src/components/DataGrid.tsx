import type { ReactNode } from "react";
import { useState } from "react";

export interface GridColumn<T> {
  key: keyof T | string;
  title: string;
  width?: number;
  sticky?: boolean;
  render?: (row: T) => ReactNode;
}

interface DataGridProps<T> {
  columns: Array<GridColumn<T>>;
  rows: T[];
}

export function DataGrid<T extends { id: string }>({ columns, rows }: DataGridProps<T>) {
  const [widths, setWidths] = useState<Record<string, number>>(
    Object.fromEntries(columns.map((column) => [String(column.key), column.width ?? 160]))
  );

  const handleResize = (key: string, movementX: number) => {
    setWidths((current) => ({
      ...current,
      [key]: Math.max(100, (current[key] ?? 160) + movementX)
    }));
  };

  return (
    <div className="grid-shell">
      <div className="grid-table">
        <div className="grid-row grid-header">
          {columns.map((column, index) => (
            <div
              key={String(column.key)}
              className={`grid-cell ${column.sticky ? "sticky" : ""}`}
              style={{ width: widths[String(column.key)], left: column.sticky ? index * 180 : undefined }}
            >
              <span className="grid-cell-content">{column.title}</span>
              <button
                type="button"
                className="resize-handle"
                aria-label={`${column.title} 너비 조절`}
                onClick={(event) => handleResize(String(column.key), event.shiftKey ? -24 : 24)}
              />
            </div>
          ))}
        </div>
        {rows.map((row) => (
          <div key={row.id} className="grid-row">
            {columns.map((column, index) => (
              <div
                key={String(column.key)}
                className={`grid-cell ${column.sticky ? "sticky" : ""}`}
                style={{ width: widths[String(column.key)], left: column.sticky ? index * 180 : undefined }}
              >
                <span className="grid-cell-content">
                  {column.render ? column.render(row) : String((row as Record<string, unknown>)[String(column.key)] ?? "")}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
