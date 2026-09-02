export default function Table({ columns, data = [], loading, emptyText = 'لا توجد بيانات', emptyIcon = 'inbox', renderRow, rowKey = 'id', className = '' }) {
  return (
    <div className="ui-table-wrap">
      <table className={`ui-table ${className}`}>
        {columns && columns.length > 0 && (
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th key={col.key ?? i} style={col.style} className={col.className}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns?.length || 1}>
                <div className="ui-table-loading">
                  <span className="ui-skeleton" style={{ height: 16, width: '80%' }} />
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns?.length || 1}>
                <div className="ui-empty-state">
                  <span className="material-icons" aria-hidden="true">{emptyIcon}</span>
                  <p>{emptyText}</p>
                </div>
              </td>
            </tr>
          ) : renderRow ? (
            data.map((row, i) => renderRow(row, i))
          ) : (
            data.map((row) => (
              <tr key={row[rowKey]}>
                {columns.map((col, i) => (
                  <td key={col.key ?? i} style={col.style}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
