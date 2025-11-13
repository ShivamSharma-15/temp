import siteCatalog from './sites.json';
import telemetryCsv from './JOD01/inverter wms and meter data/Solar91 _ Trackso API Data - Sheet1.csv?raw';

const TARGET_SITE_KEY = '6b809f8b8b';
const HISTORY_DAYS = 14;

const slugify = (value, delimiter = '-') =>
  value
    ?.toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, delimiter)
    .replace(new RegExp(`^${delimiter}+|${delimiter}+$`, 'g'), '') ?? '';

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

const telemetryDataset = parseTelemetryFile(telemetryCsv);

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
    { key: 'availabilityPct', label: 'CUF (%)', precision: 2 },
    { key: 'performanceRatioPct', label: 'PR (%)', precision: 2 },
    { key: 'irradianceWhm2', label: 'Irradiance (Wh/m²)', precision: 0 }
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
        ? `${column.group} – ${column.label}`
        : column.label;
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
    message: `Generation dipped to ${entry.energyMWh.toFixed(2)} MWh (CUF ${entry.availabilityPct.toFixed(
      1
    )} %).`,
    triggeredAt: `${entry.date}T06:00:00+05:30`,
    acknowledgedBy: null,
    resolvedAt: null
  }));
};

const defaultHistoryFields = [
  { key: 'date', label: 'Date', canHide: false },
  { key: 'energyMWh', label: 'Energy (MWh)', precision: 2 },
  { key: 'peakPowerMw', label: 'Peak (MW)', precision: 2 },
  { key: 'availabilityPct', label: 'Availability %', precision: 1 },
  { key: 'performanceRatioPct', label: 'PR (%)', precision: 1 },
  { key: 'irradianceWhm2', label: 'Irradiance (Wh/m²)', precision: 0 }
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
    return {
      id: `INV-${index + 1}-${siteName.slice(0, 3).toUpperCase()}`,
      type: 'Central Inverter',
      vendor: 'Sungrow',
      ratedMw: ratedPerInverter,
      status,
      lastOutputMwh: +(ratedPerInverter * (0.7 + rng() * 0.2)).toFixed(2),
      temperatureC: +(38 + rng() * 6).toFixed(1),
      issues: status === 'Online' ? 0 : 1
    };
  });

  units.push({
    id: `MTR-${siteName.slice(0, 3).toUpperCase()}`,
    type: 'Energy Meter',
    vendor: 'Schneider',
    ratedMw: 0.05,
    status: 'Online',
    lastOutputMwh: +(capacityMw * 0.95).toFixed(2),
    temperatureC: +(32 + rng() * 3).toFixed(1),
    issues: 0
  });

  units.push({
    id: `WMS-${siteName.slice(0, 3).toUpperCase()}`,
    type: 'Weather Station',
    vendor: 'TrackSo',
    ratedMw: 0,
    status: 'Online',
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
    sharedAccess: []
  };
};

const buildJodSite = (meta) => {
  if (!telemetryDataset.rows.length) {
    return buildSyntheticSite(meta);
  }

  const siteName = meta.name ?? 'JOD01';
  const siteId = `site-${slugify(meta.site_key ?? siteName)}`;
  const rawCapacityMw = toNumber(meta.site_capacity, 0) / 1000;
  const capacityMw = rawCapacityMw > 0 ? +rawCapacityMw.toFixed(3) : 0;
  const labelKeyMap = new Map();
  telemetryDataset.columns.forEach((column) => {
    if (!labelKeyMap.has(column.label)) {
      labelKeyMap.set(column.label, column.key);
    }
  });

  const getValue = (row, label, fallback = 0) => {
    const key = labelKeyMap.get(label);
    if (!key) return fallback;
    const value = row[key];
    return typeof value === 'number' ? value : fallback;
  };

  const energySeries = telemetryDataset.rows.map((row) => {
    const totalGeneration = getValue(row, 'Total Generation', 0);
    const energyMWh = totalGeneration / 1000;
    const availability = getValue(row, 'CUF', 0);
    const performance = getValue(row, 'PR%', availability);
    const irradiance = getValue(row, 'Solar Irradiation', 0);

    return {
      ...row,
      energyMWh: +energyMWh.toFixed(2),
      peakPowerMw: capacityMw ? +(capacityMw * 0.95).toFixed(2) : 0,
      availabilityPct: +Math.max(0, Math.min(100, availability)).toFixed(2),
      performanceRatioPct: +Math.max(0, Math.min(100, performance)).toFixed(2),
      irradianceWhm2: Math.max(0, Math.round(irradiance * 100))
    };
  });

  const avgAvailability =
    energySeries.reduce((sum, entry) => sum + entry.availabilityPct, 0) / energySeries.length;
  const avgPerformance =
    energySeries.reduce((sum, entry) => sum + entry.performanceRatioPct, 0) / energySeries.length;

  const latestRow = telemetryDataset.rows.at(-1);
  const latestWeather = buildWeatherSnapshot(latestRow, labelKeyMap);
  const historyFields = buildHistoryFields(telemetryDataset.columns);
  const units = buildUnitsFromTelemetry(telemetryDataset.columns, telemetryDataset.rows, capacityMw);
  const alarms = buildAlarmsFromSeries(energySeries, units);

  const coordinates =
    Array.isArray(meta.coordinates) && meta.coordinates.every((value) => value?.trim?.())
      ? meta.coordinates
      : null;
  const location = coordinates
    ? `Lat ${coordinates[0]}, Lon ${coordinates[1]}`
    : meta.description?.trim() || 'Location unavailable';

  return {
    id: siteId,
    siteKey: meta.site_key ?? TARGET_SITE_KEY,
    name: siteName,
    location,
    capacityMw: capacityMw ? +capacityMw.toFixed(2) : 0,
    status: mapSiteStatus(meta.status),
    installedAt: energySeries[0]?.date ?? '2024-01-01',
    lastUpdated: energySeries.at(-1)?.date
      ? `${energySeries.at(-1).date}T23:59:00+05:30`
      : new Date().toISOString(),
    technology: [
      '9 x Sungrow 320 kW inverter block',
      'Schneider EM metering stack',
      'TrackSo weather monitoring system'
    ],
    avgAvailabilityPct: +avgAvailability.toFixed(2),
    performanceRatioPct: +avgPerformance.toFixed(2),
    energySeries,
    weather: {
      current: latestWeather,
      forecast: energySeries.slice(-3).map((entry, index) => ({
        day:
          new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(
            new Date(`${entry.date}T00:00:00`)
          ),
        conditions: entry.irradianceWhm2 > 600 ? 'Sunny' : entry.irradianceWhm2 > 250 ? 'Cloudy' : 'Overcast',
        temperatureC: Math.round(
          latestWeather.temperatureC + (entry.availabilityPct - avgAvailability) * 0.1 - index
        )
      }))
    },
    units,
    alarms,
    historyFields,
    sharedAccess: []
  };
};

const seedSites = siteCatalog.map((site) =>
  site.site_key === TARGET_SITE_KEY ? buildJodSite(site) : buildSyntheticSite(site)
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
