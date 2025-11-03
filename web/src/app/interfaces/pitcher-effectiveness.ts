export interface PitcherEffectiveness {
  pitcher_team_code: string;
  batter_team_code: string;
  pitcher_name: string;
  pitch_type: string;
  
  // Stretch Metrics
  'total_pitches (stretch)': number;
  'total_swings (stretch)': number;
  'whiffs (stretch)': number;
  'contacts (stretch)': number;
  'whiff_rate (stretch)': number;
  'contact_rate (stretch)': number;

  // Windup Metrics
  'total_pitches (windup)': number;
  'total_swings (windup)': number;
  'whiffs (windup)': number;
  'contacts (windup)': number;
  'whiff_rate (windup)': number;
  'contact_rate (windup)': number;
}