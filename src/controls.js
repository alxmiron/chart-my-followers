const Observable = require('./observable');
const { omitProps, clearNodeChildren, createElement } = require('./utils');

const renderColumnControls = ($columnSwitches, sourceData) => {
  const yColumns = omitProps(sourceData, ['x']);
  clearNodeChildren($columnSwitches); // remove current switches
  Object.values(yColumns).forEach(column => {
    const label = createElement('label', { className: 'switch' });
    const input = createElement('input', { attributes: { name: column.id, type: 'checkbox', checked: true } });
    label.appendChild(input);
    label.appendChild(createElement('span', { className: 'switch-text', text: column.name }));
    $columnSwitches.appendChild(label);
  });
  return sourceData;
};

const updateSwitchesSubscriptions = ($columnSwitches, columnSwitches$) => {
  for (let idx = 0; idx < $columnSwitches.childNodes.length; idx++) {
    const $label = $columnSwitches.childNodes[idx];
    let $input;
    for (let i = 0; i < $label.childNodes.length; i++) {
      const $child = $label.childNodes[i];
      if ($child.nodeName === 'INPUT') $input = $child;
    }
    columnSwitches$.lastValue[$input.name] = $input.checked;
    $input.addEventListener('change', event =>
      columnSwitches$.broadcast({
        ...columnSwitches$.lastValue,
        [event.target.name]: event.target.checked,
      }),
    );
  }
  return columnSwitches$;
};

const getSwitchesObservable = $columnSwitches => {
  const switches$ = new Observable('columnSwitches');
  switches$.lastValue = {};
  return updateSwitchesSubscriptions($columnSwitches, switches$);
};

const renderDataSelect = ($dataSelect, dataset) => {
  Object.values(dataset).forEach((dataCase, index) => {
    const option = createElement('option', { attributes: { value: index }, text: `${index + 1}` });
    $dataSelect.appendChild(option);
  });
  return dataset;
};

module.exports = { renderColumnControls, getSwitchesObservable, updateSwitchesSubscriptions, renderDataSelect };
