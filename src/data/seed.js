import siteCatalog from './sites.json';
import novemberRaw from './JOD01/inverter wms and meter data/november.json?raw';
import unitsRaw from './JOD01/units.json?raw';
import siteOutputActivePowerRaw from './JOD01/inverter wms and meter data/siteOutputActivePower.json?raw';
import solarIrradiationRaw from './JOD01/inverter wms and meter data/solarIrradiation.json?raw';
import dailyEnergyRaw from './JOD01/inverter wms and meter data/dailyEnergy.json?raw';

const parseNumeric = (value) => {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).replace(/,/g, '').trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toNumber = (value, fallback = 0) => {
  const numeric = parseNumeric(value);
  return numeric === undefined ? fallback : numeric;
};

const TARGET_SITE_KEY = '6a11fc90ac';
const HISTORY_DAYS = 14;

const parseNovemberDailyFile = (raw) => {
  try {
    const parsed = JSON.parse(raw);
    const source = Array.isArray(parsed) ? parsed.find(Boolean) : parsed;
    if (!source || typeof source !== 'object') return [];

    // New structure: { rows: [ [ { Data, value }, ... ], ... ] }
    if (Array.isArray(source.rows)) {
      const normalizeRow = (rowArray) => {
        if (!Array.isArray(rowArray)) return null;
        let date = null;
        const entries = [];
        for (let index = 0; index < rowArray.length; index += 1) {
          const item = rowArray[index];
          if (!item || typeof item !== 'object') continue;
          if (item.Data === 'Date') {
            date = item.value ?? date;
            continue;
          }
          if (typeof item.Data === 'string' && item.Data.toLowerCase().includes('sungrow')) {
            const capacityEntry =
              rowArray[index + 1]?.Data === 'DC Capacity 1' ? rowArray[index + 1] : null;
            const generationPerKwEntry =
              rowArray[index + 2]?.Data?.toLowerCase?.().includes('generation per kw')
                ? rowArray[index + 2]
                : null;
            entries.push({
              unitName: item.Data,
              value: item.value,
              'DC Capacity 1': capacityEntry?.value,
              generationPerKw: generationPerKwEntry?.value
            });
          }
        }
        return date ? { date, entries } : null;
      };

      return source.rows
        .map((row) => normalizeRow(row))
        .filter(Boolean)
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    // Legacy structure: { "1": { "2025-11-01": [...] } }
    const dayMap =
      Object.values(source).find(
        (value) => value && typeof value === 'object' && !Array.isArray(value)
      ) ?? source;
    return Object.entries(dayMap)
      .filter(([date]) => date)
      .map(([date, entries]) => ({
        date,
        entries: Array.isArray(entries) ? entries : []
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.warn('Unable to parse November JSON file', error);
    return [];
  }
};

const ASADI_DAILY_BUCKETS = parseNovemberDailyFile(novemberRaw);
const UNITS_CATALOG = (() => {
  try {
    const parsed = JSON.parse(unitsRaw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Unable to parse units.json', error);
    return [];
  }
})();
const parseIntradayArray = (raw, label) => {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn(`Unable to parse ${label ?? 'intraday'} JSON file`, error);
    return [];
  }
};

const OUTPUT_ACTIVE_POWER_SERIES = parseIntradayArray(siteOutputActivePowerRaw, 'siteOutputActivePower');
const SOLAR_IRRADIATION_SERIES = parseIntradayArray(solarIrradiationRaw, 'solarIrradiation');
const DAILY_ENERGY_SERIES = parseIntradayArray(dailyEnergyRaw, 'dailyEnergy');

const combineIntradaySeries = (powerSeries, irradiationSeries, energySeries, prSeries = []) => {
  const map = new Map();
  const normalizeTimestamp = (timestamp) => Math.round(timestamp / 60) * 60;
  const ensure = (timestamp) => {
    if (!map.has(timestamp)) {
      map.set(timestamp, { timestamp });
    }
    return map.get(timestamp);
  };

  powerSeries.forEach((entry) => {
    if (entry?.timestamp == null) return;
    const target = ensure(normalizeTimestamp(entry.timestamp));
    target.activePower = toNumber(entry.value, 0);
    target.hasActivePower = true;
    target.parameter_name = entry.parameter_name ?? target.parameter_name;
  });

  irradiationSeries.forEach((entry) => {
    if (entry?.timestamp == null) return;
    const target = ensure(normalizeTimestamp(entry.timestamp));
    target.solarIrradiation = toNumber(entry.value, 0);
    target.hasSolarIrradiation = true;
    target.parameter_name = entry.parameter_name ?? target.parameter_name;
  });

  energySeries.forEach((entry) => {
    if (entry?.timestamp == null) return;
    const target = ensure(normalizeTimestamp(entry.timestamp));
    target.dailyEnergy = toNumber(entry.value, 0);
    target.hasDailyEnergy = true;
    target.parameter_name = entry.parameter_name ?? target.parameter_name;
  });

  prSeries.forEach((entry) => {
    if (entry?.timestamp == null) return;
    const target = ensure(normalizeTimestamp(entry.timestamp));
    target.prPct = toNumber(entry.value, 0);
    target.hasPr = true;
    target.parameter_name = entry.parameter_name ?? target.parameter_name;
  });

  const capacityKw = 3402.98;
  map.forEach((value) => {
    const powerKwp = value.activePower ?? 0;
    const irr = value.solarIrradiation ?? 0;
    if (!value.hasPr) {
      value.prPct =
        powerKwp != null && irr > 0
          ? (powerKwp * 1000 * 100) / (capacityKw * irr)
          : 0;
    }
  });

  return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
};

const monthLookup = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12'
};

const SPECIAL_FOLDER_DATES = {
  'inverter wms and meter data': '2025-11-25'
};

const toIsoDateFromFolder = (folderName) => {
  if (!folderName) return null;
  const safeName = folderName.toString();
  const normalized = safeName.toLowerCase();
  if (SPECIAL_FOLDER_DATES[normalized]) {
    return SPECIAL_FOLDER_DATES[normalized];
  }
  const match = safeName.match(/(\d{1,2})([A-Za-z]{3})(\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  const monthCode = monthLookup[month.toLowerCase()];
  if (!monthCode) return null;
  const paddedDay = day.padStart(2, '0');
  return `${year}-${monthCode}-${paddedDay}`;
};

const loadIntradayByDate = () => {
  const powerFiles = import.meta.glob('./JOD01/*/siteOutputActivePower.json', {
    eager: true,
    import: 'default'
  });
  const irradiationFiles = import.meta.glob('./JOD01/*/solarIrradiation.json', {
    eager: true,
    import: 'default'
  });
  const energyFiles = import.meta.glob('./JOD01/*/dailyEnergy.json', { eager: true, import: 'default' });
  const prFiles = import.meta.glob('./JOD01/*/Pr.json', { eager: true, import: 'default' });

  const store = new Map();
  const ensure = (isoDate) => {
    if (!store.has(isoDate)) {
      store.set(isoDate, { power: [], irradiation: [], energy: [], pr: [] });
    }
    return store.get(isoDate);
  };

  const assignSeries = (files, key) => {
    Object.entries(files).forEach(([path, data]) => {
      const match = path.match(/\.\/JOD01\/([^/]+)\//);
      if (!match) return;
      const isoDate = toIsoDateFromFolder(match[1]);
      if (!isoDate) return;
      const target = ensure(isoDate);
      target[key] = Array.isArray(data) ? data : [];
    });
  };

  assignSeries(powerFiles, 'power');
  assignSeries(irradiationFiles, 'irradiation');
  assignSeries(energyFiles, 'energy');
  assignSeries(prFiles, 'pr');

  const byDate = {};
  store.forEach((value, isoDate) => {
    byDate[isoDate] = combineIntradaySeries(
      value.power,
      value.irradiation,
      value.energy,
      value.pr
    );
  });

  const dates = [...store.keys()].sort();
  return { byDate, dates };
};

const loadCardsByDate = () => {
  const cardFiles = import.meta.glob('./JOD01/*/cardsData.json', {
    eager: true,
    import: 'default'
  });

  const byDate = {};
  Object.entries(cardFiles).forEach(([path, data]) => {
    const match = path.match(/\.\/JOD01\/([^/]+)\//);
    if (!match) return;
    const isoDate = toIsoDateFromFolder(match[1]);
    if (!isoDate) return;
    byDate[isoDate] = data && typeof data === 'object' ? data : {};
  });

  const dates = Object.keys(byDate).sort();
  return { byDate, dates };
};

const { byDate: INTRADAY_BY_DATE, dates: AVAILABLE_INTRADAY_DATES } = loadIntradayByDate();
const { byDate: CARD_DATA_BY_DATE, dates: AVAILABLE_CARD_DATES } = loadCardsByDate();

const HARD_MAX_DATE = '2025-11-25';
const EARLIEST_INTRADAY_DATE = AVAILABLE_INTRADAY_DATES[0] ?? HARD_MAX_DATE;
const DEFAULT_SELECTED_DATE =
  AVAILABLE_INTRADAY_DATES.length > 0
    ? AVAILABLE_INTRADAY_DATES.at(-1)
    : HARD_MAX_DATE;

const clampDateToBounds = (value) => {
  const iso = (value ?? '').toString().slice(0, 10);
  const parsed = new Date(`${iso}T00:00:00`);
  if (!Number.isFinite(parsed.getTime())) {
    return DEFAULT_SELECTED_DATE;
  }
  if (iso < EARLIEST_INTRADAY_DATE) return EARLIEST_INTRADAY_DATE;
  if (iso > HARD_MAX_DATE) return HARD_MAX_DATE;
  return iso;
};

const pickAvailableDate = (targetDate, availableDates) => {
  const dates = Array.isArray(availableDates) ? [...availableDates] : [];
  if (!dates.length) return clampDateToBounds(targetDate);
  dates.sort();
  const desired = clampDateToBounds(targetDate);
  const eligible = dates.filter((date) => date <= desired);
  if (eligible.length) return eligible.at(-1);
  return dates[0];
};

const ASADI_LAST_DAY_SERIES =
  AVAILABLE_INTRADAY_DATES.length > 0
    ? INTRADAY_BY_DATE[AVAILABLE_INTRADAY_DATES.at(-1)] ?? []
    : combineIntradaySeries(
        OUTPUT_ACTIVE_POWER_SERIES,
        SOLAR_IRRADIATION_SERIES,
        DAILY_ENERGY_SERIES
      );

const slugify = (value, delimiter = '-') =>
  value
    ?.toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, delimiter)
    .replace(new RegExp(`^${delimiter}+|${delimiter}+$`, 'g'), '') ?? '';

const mapSiteStatus = (status) => {
  if (!status) return 'Offline';
  const normalized = status.toLowerCase();
  if (normalized.includes('active') || normalized.includes('online') || normalized.includes('on')) {
    return 'Online';
  }
  if (normalized.includes('partial') || normalized.includes('err') || normalized.includes('warning')) {
    return 'Warning';
  }
  if (normalized.includes('maint')) return 'Maintenance';
  return 'Offline';
};

const categorizeDevice = (name = '') => {
  const lower = name.toLowerCase();
  if (lower.includes('sungrow')) return 'Central Inverter';
  if (lower.includes('standby') || lower.includes('check') || lower.includes('main')) return 'Energy Meter';
  if (lower.includes('weather')) return 'Weather Station';
  if (lower.includes('wms')) return 'Weather Station';
  if (lower.includes('meter')) return 'Energy Meter';
  return 'Auxiliary';
};

const deriveVendor = (name = '') => {
  const lower = name.toLowerCase();
  if (lower.includes('sungrow')) return 'Sungrow';
  if (lower.includes('schi')) return 'Schneider';
  if (lower.includes('wms') || lower.includes('weather')) return 'TrackSo';
  if (lower.includes('meter')) return 'Schneider';
  return 'Solar91';
};

const buildAsadiEnergySeries = (dailyBuckets, capacityMw) => {
  if (!dailyBuckets.length) return [];

  return dailyBuckets.map(({ date, entries }) => {
    const totalKwh = (entries ?? []).reduce((sum, entry) => sum + toNumber(entry.value, 0), 0);
    const totalDcKw = (entries ?? []).reduce(
      (sum, entry) => sum + toNumber(entry['DC Capacity 1'], 0),
      0
    );
    const genPerKwValues = (entries ?? [])
      .map((entry) => toNumber(entry.generationPerKw, NaN))
      .filter((value) => Number.isFinite(value));
    const avgGenerationPerKw = genPerKwValues.length
      ? +(genPerKwValues.reduce((sum, value) => sum + value, 0) / genPerKwValues.length).toFixed(2)
      : null;

    return {
      date,
      energyMWh: +((totalKwh ?? 0) / 1000).toFixed(2),
      energyKWh: +totalKwh.toFixed(2),
      totalDcCapacityMw: +(totalDcKw / 1000).toFixed(3),
      totalDcCapacityKw: +totalDcKw.toFixed(2),
      avgGenerationPerKw,
      // Keep optional fields to avoid downstream NaN
      peakPowerMw: 0,
      availabilityPct: null,
      performanceRatioPct: null,
      irradianceWhm2: 0
    };
  });
};

const buildAsadiUnits = (meta, latestEntries, capacityMw) => {
  const siteKey = meta.site_key ?? TARGET_SITE_KEY;
  const catalogUnits = UNITS_CATALOG.filter((unit) => unit.site_key === siteKey);
  const deriveType = (category, name = '') => {
    const lower = name.toLowerCase();
    if (category?.toLowerCase() === 'inverter' || lower.includes('sungrow')) return 'Central Inverter';
    if (category?.toLowerCase().includes('meter')) return 'Energy Meter';
    if (category?.toLowerCase().includes('weather')) return 'Weather Station';
    return 'Auxiliary';
  };

  if (catalogUnits.length) {
    const inverterCount = catalogUnits.filter(
      (unit) => deriveType(unit.unit_category_name, unit.name) === 'Central Inverter'
    ).length;
    const safeCount = inverterCount || catalogUnits.length || 1;
    const ratedKwPerInverter = +(capacityMw * 1000 / safeCount).toFixed(1);
    return catalogUnits.map((unit, index) => {
      const type = deriveType(unit.unit_category_name, unit.name);
      const ratedKw = type === 'Central Inverter' ? ratedKwPerInverter : +(capacityMw * 50).toFixed(1);
      const lastOutputKwh = +(ratedKw * 0.2).toFixed(1);
      return {
        id: unit.name ?? unit.unit_key ?? `UNIT-${index + 1}`,
        type,
        vendor: deriveVendor(unit.name ?? ''),
        ratedKw,
        ratedMw: +(ratedKw / 1000).toFixed(3),
        status: mapSiteStatus(unit.status),
        lastOutputKwh,
        lastOutputMwh: +(lastOutputKwh / 1000).toFixed(3),
        temperatureC: 38 + (type === 'Central Inverter' ? 4 : 0),
        issues: 0
      };
    });
  }

  const entries = Array.isArray(latestEntries) ? latestEntries : [];
  if (!entries.length) {
    return [
      {
        id: 'INV-IND-1',
        type: 'Central Inverter',
        vendor: 'Sungrow',
        ratedKw: +(capacityMw * 1000).toFixed(1),
        ratedMw: +capacityMw.toFixed(2),
        status: 'Online',
        lastOutputKwh: +(capacityMw * 1000 * 0.2).toFixed(1),
        lastOutputMwh: +(capacityMw * 0.2).toFixed(2),
        temperatureC: 42,
        issues: 0
      }
    ];
  }

  return entries.map((entry, index) => {
    const ratedMw =
      toNumber(entry['DC Capacity 1'], capacityMw ? (capacityMw * 1000) / entries.length : 0) / 1000;
    const ratedKw = ratedMw * 1000;
    const lastOutputKwh = +(toNumber(entry.value, 0)).toFixed(2);
    return {
      id: entry.unitName ?? entry.unitKey ?? `INV-${index + 1}`,
      type: 'Central Inverter',
      vendor: deriveVendor(entry.unitName ?? ''),
      ratedKw: +(ratedKw || (capacityMw / Math.max(1, entries.length)) * 1000).toFixed(1),
      ratedMw: +(ratedMw || capacityMw / Math.max(1, entries.length)).toFixed(2),
      status: 'Online',
      lastOutputKwh,
      lastOutputMwh: +(lastOutputKwh / 1000).toFixed(3),
      temperatureC: +(42 - index * 0.8).toFixed(1),
      issues: 0
    };
  });
};

const buildAsadiLastDaySeries = (dailyBuckets) => {
  const latest = dailyBuckets.at(-1);
  if (!latest) return [];
  const totalEntries = latest.entries?.length ?? 0;
  const span = Math.max(1, totalEntries - 1);
  const baseTimestamp = Math.floor(new Date(`${latest.date}T06:00:00`).getTime() / 1000);
  return (latest.entries ?? []).map((entry, index) => ({
    timestamp: baseTimestamp + index * 1800,
    dailyEnergy: toNumber(entry.value, 0),
    activePower: +(toNumber(entry.value, 0) / 24).toFixed(1),
    solarIrradiation: Math.round(500 + (index / span) * 150)
  }));
};

const sanitizeFieldKey = (base, usedKeys, index) => {
  let key =
    base
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') ?? '';
  if (!key) {
    key = `csv_col_${index}`;
  }
  while (usedKeys.has(key)) {
    key = `${key}_${index}`;
  }
  usedKeys.add(key);
  return key;
};

const parseTelemetryFile = (raw) => {
  if (!raw) return { columns: [], rows: [] };
  const lines = raw.replace(/\r/g, '').split('\n');
  if (lines.length < 3) return { columns: [], rows: [] };

  const headerTop = lines[0].split(',');
  const headerBottom = lines[1].split(',');
  const width = Math.max(headerTop.length, headerBottom.length);
  const usedKeys = new Set();
  const deviceIndexMap = {};
  const columns = [];

  const clean = (value) => value?.trim?.().replace(/\s+/g, ' ') ?? '';

  for (let index = 0; index < width; index += 1) {
    const topLabel = clean(headerTop[index] ?? '');
    const label = clean(headerBottom[index] ?? '');
    const type = label === 'Date' ? 'date' : label === 'Time' ? 'time' : 'metric';
    let deviceName = null;

    const inverterMatch = label.match(/^(\d+)\s+.+/);
    if (inverterMatch) {
      deviceName = label;
      deviceIndexMap[inverterMatch[1]] = deviceName;
    } else {
      const capacityMatch = label.match(/^(?:DC Capacity|Generation Per kW)\s*(\d+)/i);
      if (capacityMatch && deviceIndexMap[capacityMatch[1]]) {
        deviceName = deviceIndexMap[capacityMatch[1]];
      } else if (topLabel && topLabel.toLowerCase() !== 'inverter') {
        deviceName = topLabel;
      } else if (label && topLabel.toLowerCase() === 'inverter' && label.toLowerCase().includes('total')) {
        deviceName = 'Plant Aggregate';
      } else if (['Ambient Temperature', 'Module Temperature', 'Solar Irradiation', 'Wind Direction', 'Wind Speed', 'CUF', 'PR%'].includes(label)) {
        deviceName = topLabel || 'Weather Monitoring System';
      }
    }

    const keyBase = [
      deviceName && deviceName !== 'Plant Aggregate' ? deviceName : '',
      !deviceName && topLabel ? topLabel : '',
      label || `Column ${index}`
    ]
      .filter(Boolean)
      .join(' ');

    const key = sanitizeFieldKey(keyBase || `column_${index}`, usedKeys, index);

    columns.push({
      index,
      key,
      label: label || topLabel || `Column ${index + 1}`,
      group: topLabel || null,
      deviceName,
      type,
      isNumeric: false,
      average: null
    });
  }

  const dataLines = lines.slice(2).filter((line) => line.trim().length > 0);
  const rawRows = dataLines.map((line) => line.split(','));

  columns.forEach((column, columnIndex) => {
    let sum = 0;
    let count = 0;
    rawRows.forEach((values) => {
      const rawValue = (values[columnIndex] ?? '').trim();
      const numeric = parseNumeric(rawValue);
      if (numeric !== undefined) {
        sum += numeric;
        count += 1;
      }
    });
    if (count > 0) {
      column.isNumeric = true;
      column.average = sum / count;
    }
  });

  const rows = rawRows
    .map((values) => {
      const record = {};
      columns.forEach((column) => {
        const rawValue = (values[column.index] ?? '').trim();
        if (column.type === 'date') {
          record.date = rawValue;
        } else if (column.type === 'time') {
          record.time = rawValue || null;
        }
        if (column.type === 'date' || column.type === 'time') {
          record[column.key] = rawValue || null;
          return;
        }

        if (column.isNumeric) {
          const numeric = parseNumeric(rawValue);
          record[column.key] = numeric !== undefined ? numeric : column.average ?? 0;
        } else {
          record[column.key] = rawValue || null;
        }
      });
      return record.date ? record : null;
    })
    .filter(Boolean);

  return {
    columns,
    rows
  };
};

const dateISO = (offsetDays) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - offsetDays);
  return date.toISOString().slice(0, 10);
};

const buildWeatherSnapshot = (row, labelKeyMap) => {
  if (!row) {
    return {
      temperatureC: 32,
      humidityPct: 48,
      windKph: 5.2,
      ghi: 0,
      condition: 'Unknown'
    };
  }

  const ambient = toNumber(row[labelKeyMap.get('Ambient Temperature')], 32);
  const module = toNumber(row[labelKeyMap.get('Module Temperature')], ambient + 5);
  const solar = toNumber(row[labelKeyMap.get('Solar Irradiation')], 0);
  const windSpeed = toNumber(row[labelKeyMap.get('Wind Speed')], 0);
  const humidityPct = Math.max(25, Math.min(90, Math.round(78 - (module - ambient))));

  return {
    temperatureC: +ambient.toFixed(1),
    humidityPct,
    windKph: +(windSpeed * 3.6).toFixed(1),
    ghi: Math.round(solar * 100),
    condition: solar > 10 ? 'Sunny' : solar > 5 ? 'Partly cloudy' : 'Overcast'
  };
};

const buildHistoryFields = (columns) => {
  const baseFields = [
    { key: 'date', label: 'Date', canHide: false },
    { key: 'time', label: 'Time', canHide: true },
    { key: 'energyMWh', label: 'Energy (MWh)', precision: 2 },
    { key: 'peakPowerMw', label: 'Peak Power (MW)', precision: 2 },
    { key: 'performanceRatioPct', label: 'PR (%)', precision: 2 },
    { key: 'irradianceWhm2', label: 'Irradiance (Wh/m2)', precision: 0 }
  ];

  const result = [];
  const pushUnique = (field) => {
    if (!result.some((item) => item.key === field.key)) {
      result.push(field);
    }
  };

  baseFields.forEach(pushUnique);

  columns.forEach((column) => {
    if (!column.label || column.label === 'Date' || column.label === 'Time') return;
    const label =
      column.group && column.group !== 'Inverter'
        ? `${column.group} - ${column.label}`
        : column.label;
    const normalizedLabel = label.toLowerCase();
    if (normalizedLabel.includes('cuf') || normalizedLabel.includes('availab')) {
      return;
    }
    pushUnique({
      key: column.key,
      label,
      precision: column.isNumeric ? 2 : undefined,
      canHide: true
    });
  });

  return result;
};

const buildUnitsFromTelemetry = (columns, rows, capacityMw) => {
  const deviceColumnMap = new Map();
  columns.forEach((column) => {
    if (!column.deviceName || column.deviceName === 'Plant Aggregate') return;
    if (!deviceColumnMap.has(column.deviceName)) {
      deviceColumnMap.set(column.deviceName, []);
    }
    deviceColumnMap.get(column.deviceName).push(column);
  });

  const latestRow = rows.at(-1) ?? {};
  const inverterDevices = [...deviceColumnMap.keys()].filter((name) =>
    name.toLowerCase().includes('sungrow')
  );

  return [...deviceColumnMap.entries()].map(([deviceName, deviceColumns]) => {
    const type = categorizeDevice(deviceName);
    const ratedColumn = deviceColumns.find((column) => column.label.startsWith('DC Capacity'));
    let ratedMw = ratedColumn ? latestRow[ratedColumn.key] : null;
    if (typeof ratedMw === 'number') {
      ratedMw = +(ratedMw / 1000).toFixed(2);
    } else if (type === 'Central Inverter' && inverterDevices.length > 0) {
      ratedMw = +(capacityMw / inverterDevices.length).toFixed(2);
    } else {
      ratedMw = type === 'Energy Meter' ? +(capacityMw * 0.05).toFixed(2) : 0;
    }

    const energyColumn =
      deviceColumns.find((column) => column.label === deviceName) ?? deviceColumns[0];
    const lastOutput =
      energyColumn && typeof latestRow[energyColumn.key] === 'number'
        ? +(latestRow[energyColumn.key] / 1000).toFixed(2)
        : 0;

    return {
      id: deviceName,
      type,
      vendor: deriveVendor(deviceName),
      ratedMw,
      status: 'Online',
      lastOutputMwh: lastOutput,
      temperatureC:
        type === 'Central Inverter'
          ? 45
          : type === 'Weather Station'
            ? 32
            : 34,
      issues: 0
    };
  });
};

const buildAlarmsFromSeries = (energySeries, units) => {
  if (!energySeries.length) return [];
  const averageEnergy =
    energySeries.reduce((sum, entry) => sum + entry.energyMWh, 0) / energySeries.length;
  const threshold = averageEnergy * 0.8;
  const lowDays = energySeries.filter((entry) => entry.energyMWh < threshold);
  const selected = lowDays.length ? lowDays.slice(-3) : energySeries.slice(-3);

  const severityOrder = ['High', 'Medium', 'Low'];
  return selected.map((entry, index) => ({
    id: `alm-${entry.date.replace(/-/g, '')}-${index + 1}`,
    unitId: units[index % units.length]?.id ?? 'INV-1',
    severity: severityOrder[index] ?? 'Low',
    message: `Generation dipped to ${entry.energyMWh.toFixed(2)} MWh (PR ${Number(
      entry.performanceRatioPct ?? 0
    ).toFixed(1)} %).`,
    triggeredAt: `${entry.date}T06:00:00+05:30`,
    acknowledgedBy: null,
    resolvedAt: null
  }));
};

const defaultHistoryFields = [
  { key: 'date', label: 'Date', canHide: false },
  { key: 'energyMWh', label: 'Energy (MWh)', precision: 2 },
  { key: 'peakPowerMw', label: 'Peak (MW)', precision: 2 },
  { key: 'performanceRatioPct', label: 'PR (%)', precision: 1 },
  { key: 'irradianceWhm2', label: 'Irradiance (Wh/m2)', precision: 0 }
];

const mulberry32 = (seedString) => {
  let h = 1779033703 ^ seedString.length;
  for (let i = 0; i < seedString.length; i += 1) {
    h = Math.imul(h ^ seedString.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    const result = (h ^= h >>> 16) >>> 0;
    return result / 4294967296;
  };
};

const buildSyntheticEnergySeries = (rng, capacityMw) => {
  const theoreticalDaily = Math.max(1, capacityMw * 24);
  return Array.from({ length: HISTORY_DAYS }, (_, index) => {
    const offset = HISTORY_DAYS - index - 1;
    const availability = 70 + rng() * 20;
    const performance = 65 + rng() * 15;
    return {
      date: dateISO(offset),
      energyMWh: +((theoreticalDaily * availability) / 100 * (0.85 + rng() * 0.2)).toFixed(2),
      peakPowerMw: +(capacityMw * (0.85 + rng() * 0.1)).toFixed(2),
      availabilityPct: +Math.min(100, availability + rng() * 5).toFixed(2),
      performanceRatioPct: +Math.min(100, performance + rng() * 3).toFixed(2),
      irradianceWhm2: Math.round(400 + rng() * 500)
    };
  });
};

const generateUnits = (rng, capacityMw, siteName) => {
  const inverterCount = Math.min(8, Math.max(1, Math.round(capacityMw / 0.6)));
  const ratedPerInverter = +(capacityMw / inverterCount).toFixed(2);
  const units = Array.from({ length: inverterCount }, (_, index) => {
    const statusRoll = rng();
    const status =
      statusRoll > 0.95 ? 'Offline' : statusRoll > 0.85 ? 'Warning' : statusRoll > 0.9 ? 'Maintenance' : 'Online';
    const ratedKw = ratedPerInverter * 1000;
    const lastOutputMwh = +(ratedPerInverter * (0.7 + rng() * 0.2)).toFixed(2);
    return {
      id: `INV-${index + 1}-${siteName.slice(0, 3).toUpperCase()}`,
      type: 'Central Inverter',
      vendor: 'Sungrow',
      ratedMw: ratedPerInverter,
      ratedKw: +(ratedKw).toFixed(1),
      status,
      lastOutputKwh: +(lastOutputMwh * 1000).toFixed(1),
      lastOutputMwh,
      temperatureC: +(38 + rng() * 6).toFixed(1),
      issues: status === 'Online' ? 0 : 1
    };
  });

  units.push({
    id: `MTR-${siteName.slice(0, 3).toUpperCase()}`,
    type: 'Energy Meter',
    vendor: 'Schneider',
    ratedMw: 0.05,
    ratedKw: 50,
    status: 'Online',
    lastOutputKwh: +(capacityMw * 0.95 * 1000).toFixed(1),
    lastOutputMwh: +(capacityMw * 0.95).toFixed(2),
    temperatureC: +(32 + rng() * 3).toFixed(1),
    issues: 0
  });

  units.push({
    id: `WMS-${siteName.slice(0, 3).toUpperCase()}`,
    type: 'Weather Station',
    vendor: 'TrackSo',
    ratedMw: 0,
    ratedKw: 0,
    status: 'Online',
    lastOutputKwh: 0,
    lastOutputMwh: 0,
    temperatureC: +(30 + rng() * 2).toFixed(1),
    issues: 0
  });

  return units;
};

const buildSyntheticAlarms = (rng, energySeries, units) => {
  const messages = [
    'Inverter temperature above optimal range',
    'Communication drop detected',
    'Tracker alignment variance',
    'Grid export curtailed by utility',
    'Meter validation pending'
  ];
  const severities = ['Low', 'Medium', 'High'];
  const count = Math.max(1, Math.round(rng() * 3));
  return Array.from({ length: count }, (_, index) => {
    const source = energySeries[(index + 2) % energySeries.length];
    return {
      id: `alm-${source.date.replace(/-/g, '')}-${index + 1}`,
      unitId: units[Math.floor(rng() * units.length)]?.id ?? 'INV-1',
      severity: severities[Math.floor(rng() * severities.length)],
      message: messages[Math.floor(rng() * messages.length)],
      triggeredAt: `${source.date}T0${4 + index}:30:00+05:30`,
      acknowledgedBy: rng() > 0.6 ? 'Ops Center' : null,
      resolvedAt: rng() > 0.7 ? `${source.date}T1${index}:45:00+05:30` : null
    };
  });
};

const buildSyntheticSite = (meta) => {
  const rng = mulberry32(meta.site_key ?? meta.name ?? 'synthetic');
  const capacityMw = Math.max(0.1, +(toNumber(meta.site_capacity, 0) / 1000 || 0.5).toFixed(3));
  const energySeries = buildSyntheticEnergySeries(rng, capacityMw);
  const avgAvailability =
    energySeries.reduce((sum, entry) => sum + entry.availabilityPct, 0) / energySeries.length;
  const avgPerformance =
    energySeries.reduce((sum, entry) => sum + entry.performanceRatioPct, 0) / energySeries.length;
  const units = generateUnits(rng, capacityMw, meta.name ?? 'SITE');
  const alarms = buildSyntheticAlarms(rng, energySeries, units);
  const latestEntry = energySeries.at(-1);
  const weather = {
    current: {
      temperatureC: +(28 + rng() * 6).toFixed(1),
      humidityPct: Math.round(50 + rng() * 20),
      windKph: +(4 + rng() * 6).toFixed(1),
      ghi: Math.round(latestEntry?.irradianceWhm2 ?? 0),
      condition: latestEntry?.irradianceWhm2 > 600 ? 'Sunny' : 'Partly cloudy'
    },
    forecast: Array.from({ length: 3 }, (_, index) => ({
      day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][Math.floor(rng() * 7)],
      conditions: rng() > 0.5 ? 'Sunny' : 'Cloudy',
      temperatureC: Math.round(28 + rng() * 6 - index)
    }))
  };

  const coordinates =
    Array.isArray(meta.coordinates) && meta.coordinates.every((value) => value?.trim?.())
      ? meta.coordinates
      : null;
  const location = coordinates
    ? `Lat ${coordinates[0]}, Lon ${coordinates[1]}`
    : meta.description?.trim() || 'Location unavailable';

  return {
    id: `site-${slugify(meta.site_key ?? meta.name ?? 'site')}`,
    siteKey: meta.site_key ?? slugify(meta.name ?? 'site'),
    name: meta.name ?? 'Unnamed Site',
    location,
    capacityMw: +capacityMw.toFixed(2),
    status: mapSiteStatus(meta.status),
    installedAt: energySeries[0]?.date ?? dateISO(HISTORY_DAYS),
    lastUpdated: `${latestEntry?.date ?? dateISO(0)}T23:45:00+05:30`,
    technology: [
      'Mono PERC modules',
      'Central inverters',
      'SCADA monitoring'
    ],
    avgAvailabilityPct: +avgAvailability.toFixed(2),
    performanceRatioPct: +avgPerformance.toFixed(2),
    energySeries,
    weather,
    units,
    alarms,
    historyFields: defaultHistoryFields.map((field) => ({ ...field })),
    cardsByDate: {},
    availableCardDates: [],
    sharedAccess: []
  };
};

const buildAsadiSite = (meta, selectedDate = DEFAULT_SELECTED_DATE) => {
  const siteName = meta.name ?? 'Asadi';
  const siteId = `site-${slugify(meta.site_key ?? siteName)}`;
  const rawCapacityMw = toNumber(meta.site_capacity, 0) / 1000;
  const capacityMw = rawCapacityMw > 0 ? +rawCapacityMw.toFixed(3) : 0;
  const energySeries = buildAsadiEnergySeries(ASADI_DAILY_BUCKETS, capacityMw);

  if (!energySeries.length) {
    return buildSyntheticSite(meta);
  }

  const avgAvailability =
    energySeries.reduce((sum, entry) => sum + entry.availabilityPct, 0) / energySeries.length;
  const avgPerformance =
    energySeries.reduce((sum, entry) => sum + entry.performanceRatioPct, 0) / energySeries.length;
  const latestEntry = energySeries.at(-1);
  const units = buildAsadiUnits(meta, ASADI_DAILY_BUCKETS.at(-1)?.entries ?? [], capacityMw);
  const alarms = buildAlarmsFromSeries(energySeries, units);
  const effectiveDate = pickAvailableDate(selectedDate, AVAILABLE_INTRADAY_DATES);
  const lastDayData =
    AVAILABLE_INTRADAY_DATES.length > 0
      ? INTRADAY_BY_DATE[effectiveDate] ?? []
      : ASADI_LAST_DAY_SERIES.length > 0
      ? ASADI_LAST_DAY_SERIES
      : buildAsadiLastDaySeries(ASADI_DAILY_BUCKETS);

  const coordinates =
    Array.isArray(meta.coordinates) && meta.coordinates.every((value) => value?.trim?.())
      ? meta.coordinates
      : null;
  const location = coordinates
    ? `Lat ${coordinates[0]}, Lon ${coordinates[1]}`
    : meta.description?.trim() || 'Location unavailable';

  const safeDayLabel = (dateString, fallbackIndex) => {
    const parsed = new Date(`${dateString}T00:00:00`);
    if (Number.isFinite(parsed.getTime())) {
      return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(parsed);
    }
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][fallbackIndex % 7] || 'Day';
  };

  const historyFields = [
    { key: 'date', label: 'Date', canHide: false },
    { key: 'energyKWh', label: 'Energy (kWh)', precision: 0, canHide: false },
    { key: 'totalDcCapacityKw', label: 'Total DC Capacity (kW)', precision: 1, canHide: true },
    { key: 'avgGenerationPerKw', label: 'Avg Generation per kW', precision: 2, canHide: true }
  ];

  return {
    id: siteId,
    siteKey: meta.site_key ?? TARGET_SITE_KEY,
    name: siteName,
    location,
    capacityMw: capacityMw ? +capacityMw.toFixed(2) : 0,
    status: mapSiteStatus(meta.status),
    installedAt: energySeries[0]?.date ?? '2024-01-01',
    lastUpdated: latestEntry?.date
      ? `${latestEntry.date}T23:59:00+05:30`
      : new Date().toISOString(),
    technology: [
      '5 x Sungrow 320 kW inverters',
      'Schneider energy metering',
      'TrackSo weather monitoring'
    ],
    avgAvailabilityPct: +avgAvailability.toFixed(2),
    performanceRatioPct: +avgPerformance.toFixed(2),
    energySeries,
    weather: {
      current: {
        temperatureC: 31.5,
        humidityPct: 56,
        windKph: 6.1,
        ghi: Math.round(latestEntry?.irradianceWhm2 ?? 0),
        condition: latestEntry?.irradianceWhm2 > 550 ? 'Sunny' : 'Partly cloudy'
      },
      forecast: energySeries.slice(-3).map((entry, index) => ({
        day: safeDayLabel(entry.date, index),
        conditions: entry.irradianceWhm2 > 600 ? 'Sunny' : entry.irradianceWhm2 > 350 ? 'Cloudy' : 'Overcast',
        temperatureC: Math.round(30 + (entry.performanceRatioPct - avgPerformance) * 0.1 - index)
      }))
    },
    units,
    alarms,
    historyFields,
    selectedIntradayDate: effectiveDate,
    lastDayData,
    intradayByDate: INTRADAY_BY_DATE,
    availableIntradayDates: AVAILABLE_INTRADAY_DATES,
    cardsByDate: CARD_DATA_BY_DATE,
    availableCardDates: AVAILABLE_CARD_DATES,
    sharedAccess: []
  };
};

const siteCatalogEntriesRaw = Array.isArray(siteCatalog?.sites) ? siteCatalog.sites : siteCatalog;
const siteCatalogEntries = Array.isArray(siteCatalogEntriesRaw) ? siteCatalogEntriesRaw : [];
const filteredSites = siteCatalogEntries.filter((site) => site.site_key === TARGET_SITE_KEY);
const seedSites = (filteredSites.length ? filteredSites : siteCatalogEntries.slice(0, 1)).map((site) =>
  site.site_key === TARGET_SITE_KEY ? buildAsadiSite(site, DEFAULT_SELECTED_DATE) : buildSyntheticSite(site)
);

const allSiteIds = seedSites.map((site) => site.id);

export const seedUsers = [
  {
    id: 'solar91-owner',
    name: 'Solar Fleet Owner',
    email: 'owner@solar91.in',
    role: 'owner',
    accessibleSiteIds: allSiteIds
  },
  {
    id: 'solar91-admin',
    name: 'Operations Admin',
    email: 'ops.admin@solar91.in',
    role: 'admin',
    accessibleSiteIds: allSiteIds.slice(0, Math.max(3, Math.ceil(allSiteIds.length / 2)))
  },
  {
    id: 'solar91-analyst',
    name: 'Performance Analyst',
    email: 'analyst@solar91.in',
    role: 'member',
    accessibleSiteIds: allSiteIds.slice(0, Math.max(1, Math.ceil(allSiteIds.length / 4)))
  }
];

export { seedSites };
export {
  AVAILABLE_INTRADAY_DATES,
  EARLIEST_INTRADAY_DATE,
  HARD_MAX_DATE,
  DEFAULT_SELECTED_DATE,
  INTRADAY_BY_DATE
};

export const fleetBenchmarks = {
  totalCapacityMw: seedSites.reduce((acc, site) => acc + site.capacityMw, 0),
  averagePerformanceRatio:
    seedSites.length > 0
      ? (
          seedSites.reduce((acc, site) => acc + site.performanceRatioPct, 0) / seedSites.length
        ).toFixed(1)
      : '0.0',
  lastUpdated: seedSites[0]?.lastUpdated ?? new Date().toISOString()
};
