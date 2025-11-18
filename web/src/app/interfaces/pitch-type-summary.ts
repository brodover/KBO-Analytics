export interface PitchTypeSummary {
  pitch_type: string;
  count: number;
  // Average Release Point
  avg_x0: number;
  avg_z0: number;
  // Average Projection Point at 150ms
  avg_proj_x_150ms: number;
  avg_proj_z_150ms: number;
}