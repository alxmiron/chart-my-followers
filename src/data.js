exports.formatChartData = dataset => {
  return dataset.map(dataCase => {
    const columns = dataCase.columns.reduce((acc, column) => {
      const columnId = column[0];
      acc[columnId] = {
        id: columnId,
        data: column.slice(1),
        color: dataCase.colors[columnId],
        name: dataCase.names[columnId],
        type: dataCase.types[columnId],
      };
      return acc;
    }, {});
    return { columns, slider: { left: 0, right: 1 } };
  });
};
