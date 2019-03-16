const Observable = require('./observable');
const { omitProps } = require('./utils');

const renderColumnControls = ($columnSwitches, sourceData) => {
  const yColumns = omitProps(sourceData, ['x']);
  while ($columnSwitches.firstChild) $columnSwitches.removeChild($columnSwitches.firstChild); // remove current switches
  Object.values(yColumns).forEach(column => {
    const label = document.createElement('label');
    label.className = 'switch';
    const input = document.createElement('input');
    input.name = column.id;
    input.type = 'checkbox';
    input.checked = true;
    label.appendChild(input);
    const span = document.createElement('span');
    span.className = 'switch-text';
    span.appendChild(document.createTextNode(column.name));
    label.appendChild(span);
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
    const option = document.createElement('option');
    option.value = index;
    option.appendChild(document.createTextNode(`${index + 1}`));
    $dataSelect.appendChild(option);
  });
  return dataset;
};

module.exports = { renderColumnControls, getSwitchesObservable, updateSwitchesSubscriptions, renderDataSelect };
