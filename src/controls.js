const Observable = require('./observable');
const { omitProps, clearNodeChildren, createElement } = require('./utils');

const renderColumnControls = ($columnSwitches, sourceData) => {
  const yColumns = omitProps(sourceData.columns, ['x']);
  clearNodeChildren($columnSwitches); // remove current switches
  Object.values(yColumns).forEach(column => {
    const label = createElement('label', { className: 'switch-button' });
    const input = createElement('input', { attributes: { name: column.id, type: 'checkbox', checked: true, className: 'switch-checkbox' } });
    label.appendChild(input);
    const indicator = createElement('span', { className: 'switch-checkbox-indicator' });
    indicator.style.backgroundColor = column.color;
    label.appendChild(indicator);
    const text = createElement('span', { className: 'switch-button-text', text: column.name });
    label.appendChild(text);
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
    columnSwitches$.lastValue[$input.name] = $input.checked ? 1 : 0;
    $input.addEventListener('change', event =>
      columnSwitches$.broadcast({
        ...columnSwitches$.lastValue,
        [event.target.name]: event.target.checked ? 1 : 0,
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
