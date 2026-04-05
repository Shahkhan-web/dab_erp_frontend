/**
 * Static location data for Pakistan - reusable across delivery orders, addresses, etc.
 * Country: Pakistan; States: Provinces/Territories; Cities: Major cities per state.
 */

export interface LocationCity {
  id: string;
  name: string;
  stateId: string;
}

export interface LocationState {
  id: string;
  name: string;
  countryId: string;
}

export interface LocationCountry {
  id: string;
  name: string;
}

export const PAKISTAN_COUNTRY: LocationCountry = { id: 'PK', name: 'Pakistan' };

export const PAKISTAN_STATES: LocationState[] = [
  { id: 'PK-PB', name: 'Punjab', countryId: 'PK' },
  { id: 'PK-SD', name: 'Sindh', countryId: 'PK' },
  { id: 'PK-KP', name: 'Khyber Pakhtunkhwa', countryId: 'PK' },
  { id: 'PK-BL', name: 'Balochistan', countryId: 'PK' },
  { id: 'PK-ICT', name: 'Islamabad Capital Territory', countryId: 'PK' },
  { id: 'PK-AJK', name: 'Azad Jammu & Kashmir', countryId: 'PK' },
  { id: 'PK-GB', name: 'Gilgit-Baltistan', countryId: 'PK' },
];

export const PAKISTAN_CITIES: LocationCity[] = [
  // Punjab
  { id: 'PB-LHR', name: 'Lahore', stateId: 'PK-PB' },
  { id: 'PB-FSD', name: 'Faisalabad', stateId: 'PK-PB' },
  { id: 'PB-RWP', name: 'Rawalpindi', stateId: 'PK-PB' },
  { id: 'PB-GJW', name: 'Gujranwala', stateId: 'PK-PB' },
  { id: 'PB-MUX', name: 'Multan', stateId: 'PK-PB' },
  { id: 'PB-SKT', name: 'Sialkot', stateId: 'PK-PB' },
  { id: 'PB-BWN', name: 'Bahawalpur', stateId: 'PK-PB' },
  { id: 'PB-SKH', name: 'Sargodha', stateId: 'PK-PB' },
  { id: 'PB-GJR', name: 'Gujrat', stateId: 'PK-PB' },
  { id: 'PB-DGK', name: 'Dera Ghazi Khan', stateId: 'PK-PB' },
  { id: 'PB-SAH', name: 'Sahiwal', stateId: 'PK-PB' },
  { id: 'PB-JHG', name: 'Jhang', stateId: 'PK-PB' },
  { id: 'PB-MBD', name: 'Mianwali', stateId: 'PK-PB' },
  { id: 'PB-LYA', name: 'Layyah', stateId: 'PK-PB' },
  { id: 'PB-KSW', name: 'Kasur', stateId: 'PK-PB' },
  { id: 'PB-OKR', name: 'Okara', stateId: 'PK-PB' },
  { id: 'PB-VHR', name: 'Vehari', stateId: 'PK-PB' },
  { id: 'PB-PTW', name: 'Pakpattan', stateId: 'PK-PB' },
  { id: 'PB-ATK', name: 'Attock', stateId: 'PK-PB' },
  { id: 'PB-TTG', name: 'Toba Tek Singh', stateId: 'PK-PB' },
  // Sindh
  { id: 'SD-KHI', name: 'Karachi', stateId: 'PK-SD' },
  { id: 'SD-HYD', name: 'Hyderabad', stateId: 'PK-SD' },
  { id: 'SD-SUK', name: 'Sukkur', stateId: 'PK-SD' },
  { id: 'SD-LRK', name: 'Larkana', stateId: 'PK-SD' },
  { id: 'SD-NWS', name: 'Nawabshah', stateId: 'PK-SD' },
  { id: 'SD-MRP', name: 'Mirpur Khas', stateId: 'PK-SD' },
  { id: 'SD-JAC', name: 'Jacobabad', stateId: 'PK-SD' },
  { id: 'SD-SBA', name: 'Shikarpur', stateId: 'PK-SD' },
  { id: 'SD-Dadu', name: 'Dadu', stateId: 'PK-SD' },
  { id: 'SD-Badin', name: 'Badin', stateId: 'PK-SD' },
  { id: 'SD-TMK', name: 'Thatta', stateId: 'PK-SD' },
  { id: 'SD-SANG', name: 'Sanghar', stateId: 'PK-SD' },
  // Khyber Pakhtunkhwa
  { id: 'KP-PSH', name: 'Peshawar', stateId: 'PK-KP' },
  { id: 'KP-MRD', name: 'Mardan', stateId: 'PK-KP' },
  { id: 'KP-MNS', name: 'Mingora', stateId: 'PK-KP' },
  { id: 'KP-ABB', name: 'Abbottabad', stateId: 'PK-KP' },
  { id: 'KP-DIK', name: 'Dera Ismail Khan', stateId: 'PK-KP' },
  { id: 'KP-COH', name: 'Kohat', stateId: 'PK-KP' },
  { id: 'KP-BNN', name: 'Bannu', stateId: 'PK-KP' },
  { id: 'KP-SWD', name: 'Swabi', stateId: 'PK-KP' },
  { id: 'KP-NOS', name: 'Nowshera', stateId: 'PK-KP' },
  { id: 'KP-CHR', name: 'Charsadda', stateId: 'PK-KP' },
  { id: 'KP-HRP', name: 'Haripur', stateId: 'PK-KP' },
  { id: 'KP-MNSH', name: 'Mansehra', stateId: 'PK-KP' },
  // Balochistan
  { id: 'BL-QTA', name: 'Quetta', stateId: 'PK-BL' },
  { id: 'BL-TFT', name: 'Turbat', stateId: 'PK-BL' },
  { id: 'BL-KHZ', name: 'Khuzdar', stateId: 'PK-BL' },
  { id: 'BL-CHG', name: 'Chaman', stateId: 'PK-BL' },
  { id: 'BL-ZOB', name: 'Zhob', stateId: 'PK-BL' },
  { id: 'BL-GWK', name: 'Gwadar', stateId: 'PK-BL' },
  { id: 'BL-DBK', name: 'Dera Bugti', stateId: 'PK-BL' },
  { id: 'BL-SIB', name: 'Sibi', stateId: 'PK-BL' },
  { id: 'BL-LOR', name: 'Loralai', stateId: 'PK-BL' },
  // Islamabad Capital Territory
  { id: 'ICT-ISB', name: 'Islamabad', stateId: 'PK-ICT' },
  // Azad Jammu & Kashmir
  { id: 'AJK-MZF', name: 'Muzaffarabad', stateId: 'PK-AJK' },
  { id: 'AJK-MIR', name: 'Mirpur', stateId: 'PK-AJK' },
  { id: 'AJK-RWK', name: 'Rawalakot', stateId: 'PK-AJK' },
  { id: 'AJK-KOT', name: 'Kotli', stateId: 'PK-AJK' },
  { id: 'AJK-BHM', name: 'Bhimber', stateId: 'PK-AJK' },
  // Gilgit-Baltistan
  { id: 'GB-GLT', name: 'Gilgit', stateId: 'PK-GB' },
  { id: 'GB-SKD', name: 'Skardu', stateId: 'PK-GB' },
  { id: 'GB-DMS', name: 'Diamer', stateId: 'PK-GB' },
  { id: 'GB-GHC', name: 'Ghizer', stateId: 'PK-GB' },
  { id: 'GB-HNZ', name: 'Hunza', stateId: 'PK-GB' },
  { id: 'GB-ASD', name: 'Astore', stateId: 'PK-GB' },
];

/** Single country list for dropdowns (e.g. default Pakistan only) */
export function getCountries(): LocationCountry[] {
  return [PAKISTAN_COUNTRY];
}

/** Get states/provinces for Pakistan (or by countryId if extended later) */
export function getStates(countryId?: string): LocationState[] {
  if (countryId && countryId !== 'PK') return [];
  return PAKISTAN_STATES;
}

/** Get cities for a state, or all Pakistan cities if no stateId */
export function getCities(stateId?: string): LocationCity[] {
  if (!stateId) return PAKISTAN_CITIES;
  return PAKISTAN_CITIES.filter((c) => c.stateId === stateId);
}

/** Get country name by id */
export function getCountryNameById(countryId: string | null | undefined): string {
  if (!countryId) return '—';
  const c = getCountries().find((x) => x.id === countryId);
  return c ? c.name : '—';
}

/** Get state name by id */
export function getStateNameById(stateId: string | null | undefined): string {
  if (!stateId) return '—';
  const s = PAKISTAN_STATES.find((x) => x.id === stateId);
  return s ? s.name : '—';
}

/** Get city name by id */
export function getCityNameById(cityId: string | null | undefined): string {
  if (!cityId) return '—';
  const c = PAKISTAN_CITIES.find((x) => x.id === cityId);
  return c ? c.name : '—';
}
