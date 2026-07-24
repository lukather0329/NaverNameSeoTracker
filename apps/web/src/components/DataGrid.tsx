import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useState } from "react";

export interface GridColumn<T> {
  key: keyof T | string;
  title: string;
  width?: number;
  sticky?: boolean;
  // true면 셀 내용이 말줄임(...) 대신 다음 줄로 줄바꿈되어 여러 줄로 표시된다.
  // (예: SEO 상품명처럼 길어도 잘리면 안 되는 텍스트)
  wrap?: boolean;
  render?: (row: T) => ReactNode;
}

interface DataGridProps<T> {
  columns: Array<GridColumn<T>>;
  rows: T[];
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: (checked: boolean) => void;
}

export function DataGrid<T extends { id: string }>({
  columns,
  rows,
  selectable = false,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll
}: DataGridProps<T>) {
  const [widths, setWidths] = useState<Record<string, number>>(
    Object.fromEntries(columns.map((column) => [String(column.key), column.width ?? 160]))
  );

  const applyResize = (key: string, delta: number) => {
    setWidths((current) => ({
      ...current,
      [key]: Math.max(100, (current[key] ?? 160) + delta)
    }));
  };

  // 실제 드래그로 너비를 조절한다. 클릭 한 번에 24px씩만 늘어나던 기존 방식은
  // 사용자에게 "조절이 안 된다"는 인상을 줬기 때문에, mousedown → mousemove → mouseup
  // 흐름으로 마우스를 끄는 만큼 실시간으로 너비가 바뀌도록 바꾼다.
  const handleResizeStart = (key: string) => (event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = widths[key] ?? 160;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.max(100, startWidth + (moveEvent.clientX - startX));
      setWidths((current) => ({ ...current, [key]: nextWidth }));
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleResizeDoubleClick = (key: string) => () => {
    const original = columns.find((column) => String(column.key) === key)?.width ?? 160;
    setWidths((current) => ({ ...current, [key]: original }));
  };

  const checkboxColumnWidth = 44;
  const allSelected = selectable && rows.length > 0 && rows.every((row) => selectedIds?.has(row.id));
  const someSelected = selectable && !allSelected && rows.some((row) => selectedIds?.has(row.id));

  // sticky 컬럼의 left 오프셋은 고정값이 아니라 앞쪽 sticky 컬럼들의 실제 너비 누적값이어야 한다.
  // (체크박스 44px + 이전 sticky 컬럼들의 실제 width) — 그렇지 않으면 sticky 컬럼끼리 겹친다.
  let runningStickyLeft = selectable ? checkboxColumnWidth : 0;
  const stickyLefts = columns.map((column) => {
    if (!column.sticky) {
      return undefined;
    }
    const left = runningStickyLeft;
    runningStickyLeft += widths[String(column.key)] ?? column.width ?? 160;
    return left;
  });

  return (
    <div className="grid-shell">
      <div className="grid-table">
        <div className="grid-row grid-header">
          {selectable && (
            <div className="grid-cell grid-select-cell sticky" style={{ width: checkboxColumnWidth, left: 0 }}>
              <input
                type="checkbox"
                aria-label="전체 선택"
                checked={allSelected}
                ref={(element) => {
                  if (element) {
                    element.indeterminate = someSelected;
                  }
                }}
                onChange={(event) => onToggleSelectAll?.(event.target.checked)}
              />
            </div>
          )}
          {columns.map((column, index) => (
            <div
              key={String(column.key)}
              className={`grid-cell ${column.sticky ? "sticky" : ""}`}
              style={{ width: widths[String(column.key)], left: stickyLefts[index] }}
            >
              <span className="grid-cell-content">{column.title}</span>
              <div
                role="separator"
                aria-orientation="vertical"
                tabIndex={0}
                className="resize-handle"
                title={`${column.title} 너비 조절 (드래그, 더블클릭으로 초기화, 방향키로 미세조절)`}
                onMouseDown={handleResizeStart(String(column.key))}
                onDoubleClick={handleResizeDoubleClick(String(column.key))}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight") {
                    applyResize(String(column.key), 24);
                  } else if (event.key === "ArrowLeft") {
                    applyResize(String(column.key), -24);
                  }
                }}
              />
            </div>
          ))}
        </div>
        {rows.map((row) => {
          const isSelected = Boolean(selectedIds?.has(row.id));
          return (
            <div key={row.id} className={`grid-row ${isSelected ? "selected" : ""}`}>
              {selectable && (
                <div className="grid-cell grid-select-cell sticky" style={{ width: checkboxColumnWidth, left: 0 }}>
                  <input
                    type="checkbox"
                    aria-label="행 선택"
                    checked={isSelected}
                    onChange={() => onToggleSelect?.(row.id)}
                  />
                </div>
              )}
              {columns.map((column, index) => (
                <div
                  key={String(column.key)}
                  className={`grid-cell ${column.sticky ? "sticky" : ""} ${column.wrap ? "wrap" : ""}`}
                  style={{ width: widths[String(column.key)], left: stickyLefts[index] }}
                >
                  <span className={`grid-cell-content ${column.wrap ? "wrap" : ""}`}>
                    {column.render ? column.render(row) : String((row as Record<string, unknown>)[String(column.key)] ?? "")}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
