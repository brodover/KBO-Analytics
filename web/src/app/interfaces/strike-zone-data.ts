export interface StrikeZoneData {
  entity_type: 'ALL' | 'TEAM' | 'BATTER';
  entity_name: string; // 'ALL', 'LG', '고승민', etc.
  avg_strikezone_top: number;
  avg_strikezone_btm: number;
}