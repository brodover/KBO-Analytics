export interface PitcherEffectiveness {
  pitcher_team_code: string;
  batter_team_code: string;
  pitcher_name: string;
  pitch_type: string;
  
  // Windup Metrics
  'pitches (windup)': number;
  'swing rate (windup)': number;
  'whiff rate (windup)': number;
  'contact rate (windup)': number;

  // Stretch Metrics
  'pitches (stretch)': number;
  'swing rate (stretch)': number;
  'whiff rate (stretch)': number;
  'contact rate (stretch)': number;
}