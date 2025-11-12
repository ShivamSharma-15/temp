export const seedUsers = [
  {
    id: 'user-owner',
    name: 'Anita Owner',
    email: 'anita.owner@solarfleet.example',
    role: 'owner',
    accessibleSiteIds: ['site-desert-bloom', 'site-coastal-breeze', 'site-rolling-hills']
  },
  {
    id: 'user-admin',
    name: 'Devon Admin',
    email: 'devon.admin@solarfleet.example',
    role: 'admin',
    accessibleSiteIds: ['site-desert-bloom', 'site-coastal-breeze']
  },
  {
    id: 'user-member',
    name: 'Maya Member',
    email: 'maya.member@solarfleet.example',
    role: 'member',
    accessibleSiteIds: ['site-desert-bloom']
  }
];

const date = (offset) => {
  const d = new Date('2024-09-18');
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
};

const makeSeries = (values) =>
  values.map((value, index) => ({
    date: date(values.length - index - 1),
    ...value
  }));

export const seedSites = [
  {
    id: 'site-desert-bloom',
    name: 'Desert Bloom Solar',
    location: 'Phoenix, AZ',
    capacityMw: 42,
    status: 'Operational',
    installedAt: '2020-04-12',
    lastUpdated: '2024-09-18T10:35:00-07:00',
    technology: ['Mono PERC', 'Central Inverters', 'Single Axis Trackers'],
    avgAvailabilityPct: 98.6,
    performanceRatioPct: 82.4,
    energySeries: makeSeries([
      { energyMWh: 175, irradianceWhm2: 6120, peakPowerMw: 39.8, availabilityPct: 99.2 },
      { energyMWh: 168, irradianceWhm2: 5986, peakPowerMw: 38.9, availabilityPct: 98.7 },
      { energyMWh: 182, irradianceWhm2: 6412, peakPowerMw: 40.3, availabilityPct: 99.4 },
      { energyMWh: 164, irradianceWhm2: 5825, peakPowerMw: 38.1, availabilityPct: 98.1 },
      { energyMWh: 171, irradianceWhm2: 6054, peakPowerMw: 39.2, availabilityPct: 98.9 },
      { energyMWh: 189, irradianceWhm2: 6529, peakPowerMw: 40.7, availabilityPct: 99.6 },
      { energyMWh: 177, irradianceWhm2: 6181, peakPowerMw: 39.9, availabilityPct: 98.8 }
    ]),
    weather: {
      current: {
        temperatureC: 34,
        humidityPct: 28,
        windMps: 4.3,
        conditions: 'Clear',
        ghiWhm2: 6180
      },
      forecast: [
        { day: 'Thu', conditions: 'Sunny', temperatureC: 35 },
        { day: 'Fri', conditions: 'Sunny', temperatureC: 36 },
        { day: 'Sat', conditions: 'Partly cloudy', temperatureC: 34 }
      ]
    },
    units: [
      {
        id: 'inv-1001',
        type: 'Central Inverter',
        vendor: 'SMA',
        ratedMw: 1.5,
        status: 'Online',
        lastOutputMwh: 7.8,
        temperatureC: 44,
        issues: 0
      },
      {
        id: 'inv-1005',
        type: 'Central Inverter',
        vendor: 'SMA',
        ratedMw: 1.5,
        status: 'Warning',
        lastOutputMwh: 6.9,
        temperatureC: 51,
        issues: 1
      },
      {
        id: 'met-2002',
        type: 'Weather Station',
        vendor: 'Campbell',
        ratedMw: 0,
        status: 'Online',
        lastOutputMwh: 0,
        temperatureC: 33,
        issues: 0
      }
    ],
    alarms: [
      {
        id: 'alm-7764',
        unitId: 'inv-1005',
        severity: 'High',
        message: 'DC string current imbalance detected',
        triggeredAt: '2024-09-18T09:05:00-07:00',
        acknowledgedBy: null,
        resolvedAt: null
      },
      {
        id: 'alm-7621',
        unitId: 'inv-1002',
        severity: 'Medium',
        message: 'Inverter temperature above optimal range',
        triggeredAt: '2024-09-17T15:42:00-07:00',
        acknowledgedBy: 'Devon Admin',
        resolvedAt: '2024-09-17T17:10:00-07:00'
      }
    ],
    sharedAccess: [
      { email: 'ops-team@solarfleet.example', role: 'member', addedAt: '2024-07-03' }
    ]
  },
  {
    id: 'site-coastal-breeze',
    name: 'Coastal Breeze Solar',
    location: 'San Luis Obispo, CA',
    capacityMw: 28,
    status: 'Operational',
    installedAt: '2021-03-30',
    lastUpdated: '2024-09-18T09:58:00-07:00',
    technology: ['Bi-facial Modules', 'String Inverters', 'Fixed Tilt'],
    avgAvailabilityPct: 97.4,
    performanceRatioPct: 79.9,
    energySeries: makeSeries([
      { energyMWh: 118, irradianceWhm2: 5251, peakPowerMw: 25.2, availabilityPct: 97.8 },
      { energyMWh: 112, irradianceWhm2: 5110, peakPowerMw: 24.8, availabilityPct: 96.9 },
      { energyMWh: 124, irradianceWhm2: 5382, peakPowerMw: 26.4, availabilityPct: 98.3 },
      { energyMWh: 107, irradianceWhm2: 4985, peakPowerMw: 24.1, availabilityPct: 96.5 },
      { energyMWh: 116, irradianceWhm2: 5194, peakPowerMw: 25.6, availabilityPct: 97.1 },
      { energyMWh: 127, irradianceWhm2: 5460, peakPowerMw: 26.9, availabilityPct: 98.5 },
      { energyMWh: 121, irradianceWhm2: 5312, peakPowerMw: 25.7, availabilityPct: 97.6 }
    ]),
    weather: {
      current: {
        temperatureC: 22,
        humidityPct: 62,
        windMps: 6.1,
        conditions: 'Partly cloudy',
        ghiWhm2: 5320
      },
      forecast: [
        { day: 'Thu', conditions: 'AM clouds', temperatureC: 22 },
        { day: 'Fri', conditions: 'Partly cloudy', temperatureC: 23 },
        { day: 'Sat', conditions: 'Sunny', temperatureC: 24 }
      ]
    },
    units: [
      {
        id: 'inv-2103',
        type: 'String Inverter',
        vendor: 'Huawei',
        ratedMw: 0.23,
        status: 'Online',
        lastOutputMwh: 1.2,
        temperatureC: 39,
        issues: 0
      },
      {
        id: 'inv-2105',
        type: 'String Inverter',
        vendor: 'Huawei',
        ratedMw: 0.23,
        status: 'Offline',
        lastOutputMwh: 0,
        temperatureC: 0,
        issues: 2
      },
      {
        id: 'met-2201',
        type: 'Weather Station',
        vendor: 'Vaisala',
        ratedMw: 0,
        status: 'Online',
        lastOutputMwh: 0,
        temperatureC: 21,
        issues: 0
      }
    ],
    alarms: [
      {
        id: 'alm-8012',
        unitId: 'inv-2105',
        severity: 'Critical',
        message: 'Inverter offline longer than 30 minutes',
        triggeredAt: '2024-09-18T07:12:00-07:00',
        acknowledgedBy: null,
        resolvedAt: null
      }
    ],
    sharedAccess: []
  },
  {
    id: 'site-rolling-hills',
    name: 'Rolling Hills Solar',
    location: 'Austin, TX',
    capacityMw: 36,
    status: 'Commissioning',
    installedAt: '2024-05-18',
    lastUpdated: '2024-09-18T11:22:00-05:00',
    technology: ['Mono PERC', 'Central Inverters', 'Fixed Tilt'],
    avgAvailabilityPct: 93.1,
    performanceRatioPct: 72.3,
    energySeries: makeSeries([
      { energyMWh: 88, irradianceWhm2: 4015, peakPowerMw: 21.4, availabilityPct: 92.1 },
      { energyMWh: 94, irradianceWhm2: 4198, peakPowerMw: 22.3, availabilityPct: 93.4 },
      { energyMWh: 101, irradianceWhm2: 4384, peakPowerMw: 23.5, availabilityPct: 95.1 },
      { energyMWh: 86, irradianceWhm2: 3962, peakPowerMw: 20.7, availabilityPct: 91.3 },
      { energyMWh: 99, irradianceWhm2: 4294, peakPowerMw: 22.9, availabilityPct: 94.8 },
      { energyMWh: 104, irradianceWhm2: 4458, peakPowerMw: 24.1, availabilityPct: 95.7 },
      { energyMWh: 97, irradianceWhm2: 4236, peakPowerMw: 22.5, availabilityPct: 93.9 }
    ]),
    weather: {
      current: {
        temperatureC: 30,
        humidityPct: 48,
        windMps: 5.7,
        conditions: 'Sunny',
        ghiWhm2: 4370
      },
      forecast: [
        { day: 'Thu', conditions: 'Sunny', temperatureC: 32 },
        { day: 'Fri', conditions: 'Scattered storms', temperatureC: 31 },
        { day: 'Sat', conditions: 'Sunny', temperatureC: 32 }
      ]
    },
    units: [
      {
        id: 'inv-3101',
        type: 'Central Inverter',
        vendor: 'GE',
        ratedMw: 1.2,
        status: 'Online',
        lastOutputMwh: 5.5,
        temperatureC: 41,
        issues: 0
      },
      {
        id: 'inv-3102',
        type: 'Central Inverter',
        vendor: 'GE',
        ratedMw: 1.2,
        status: 'Maintenance',
        lastOutputMwh: 0,
        temperatureC: 0,
        issues: 1
      },
      {
        id: 'met-3201',
        type: 'Weather Station',
        vendor: 'Campbell',
        ratedMw: 0,
        status: 'Online',
        lastOutputMwh: 0,
        temperatureC: 29,
        issues: 0
      }
    ],
    alarms: [
      {
        id: 'alm-8801',
        unitId: 'inv-3102',
        severity: 'Low',
        message: 'Preventive maintenance active',
        triggeredAt: '2024-09-16T08:30:00-05:00',
        acknowledgedBy: 'Commissioning Team',
        resolvedAt: null
      }
    ],
    sharedAccess: [
      { email: 'construction@solarfleet.example', role: 'admin', addedAt: '2024-05-22' }
    ]
  }
];

export const fleetBenchmarks = {
  totalCapacityMw: seedSites.reduce((acc, site) => acc + site.capacityMw, 0),
  averagePerformanceRatio: (
    seedSites.reduce((acc, site) => acc + site.performanceRatioPct, 0) / seedSites.length
  ).toFixed(1),
  lastUpdated: '2024-09-18T11:45:00-07:00'
};
