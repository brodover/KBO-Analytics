import { HttpClient } from '@angular/common/http';
import { Component, AfterViewInit, ElementRef, ViewChild, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as vegaEmbed from 'vega-embed';
import { StrikeZoneData } from '../interfaces/pitching';

// --- CONFIG CONSTANTS (For cleaner code) ---
const HALF_PLATE_WIDTH = 0.708;
const ONE_THIRD_PLATE_WIDTH = HALF_PLATE_WIDTH / 3.0;
const LOTTE_TEAM_CODE = 'LT';
const DEFAULT_ZONE_TOP = 3.4;
const DEFAULT_ZONE_BTM = 1.6;

@Component({
    standalone: true,
    selector: 'app-pitch-chart',
    templateUrl: './pitch-chart.html',
    styleUrl: './pitch-chart.css',
    imports: [
        CommonModule,
        FormsModule
    ],
})
export class PitchChart implements AfterViewInit {
    // --- VEGA/DATA STATE ---
    @ViewChild('chartContainer', { static: false }) chartContainer!: ElementRef;
    private vegaView: any = null;
    private strikeZoneData: StrikeZoneData[] = [];
    private pitchDataSpec: any = null;

    // --- CHART MODE STATE (Bound to UI) ---
    playerType: 'batters' | 'pitchers' = 'batters'; // Lotte Batters (Offense) or Lotte Pitchers (Defense)
    opponentTeam: string = 'HH';
    opponentTeams: string[] = ['HH', 'HT', 'KT', 'LG', 'NC', 'OB', 'SK', 'SS', 'WO'];
    
    // NOTE: selectedBatter/Pitcher is managed by Vega signals, not needed as component state
    private selectedBatter: string = 'ALL'; 

    // --- DYNAMIC DATA STREAM NAMES (Used for Vega updates) ---
    private baseZoneDataName: string | undefined = '';
    private dynamicZoneDataName: string | undefined = '';
    private verticalGridDataName: string | undefined = ''; // Vertical grid lines are static but need their data name
    private horizontalGridDataName: string | undefined = '';

    // --- COORDINATE STATE (Calculated values) ---
    currentBaseZoneTop: number = DEFAULT_ZONE_TOP;
    currentBaseZoneBtm: number = DEFAULT_ZONE_BTM;
    currentDynamicZoneTop: number = DEFAULT_ZONE_TOP;
    currentDynamicZoneBtm: number = DEFAULT_ZONE_BTM;
    currentGridY1: number = 0; // 1/3 point
    currentGridY2: number = 0; // 2/3 point

    constructor(
        @Inject(PLATFORM_ID) private platformId: Object,
        private el: ElementRef, 
        private http: HttpClient
    ) {}

    ngAfterViewInit(): void {
        this.initializeChart();
    }

    // --- INITIALIZATION AND FETCHING ---

    private async initializeChart(): Promise<void> {
        await this.fetchStrikeZoneData();
        this.loadChart();
    }

    private fetchStrikeZoneData(): Promise<void> {
        return new Promise((resolve) => {
            this.http.get<StrikeZoneData[]>(`assets/strikezone_summary.json`).subscribe({
                next: (data) => {
                    this.strikeZoneData = data;
                    resolve();
                },
                error: (err) => {
                    console.error('Error fetching strike zone data', err);
                    resolve(); // Resolve anyway to proceed
                }
            });
        });
    }

    loadChart(): void {
        if (!isPlatformBrowser(this.platformId)) {
            console.log('Skipping Vega-Embed execution on the server side.');
            return;
        }

        const filename = `LT_${this.playerType}_vs_${this.opponentTeam}_discipline.json`;
        const chartUrl = `assets/${filename}`;

        console.log('>>> Attempting to load chart:', chartUrl);

        this.http.get(chartUrl).subscribe({
            next: (data: any) => {
                this.pitchDataSpec = data;
                this.renderChart();
            },
            error: (err) => {
                console.error('Failed to load chart JSON:', err);
            }
        });
    }

    // --- RENDERING AND SETUP ---

    private renderChart(): void {
        this.updateStrikeZoneCoordinates();

        if (!this.pitchDataSpec) return;
        
        const container = this.el.nativeElement.querySelector('#vega-chart-container');
        if (container) {
            // 1. Inject coordinates and find data stream names
            const updatedSpec = this.injectVegaDataNames(this.pitchDataSpec);

            // 2. Render
            container.innerHTML = '';
            vegaEmbed.default(container, updatedSpec, { actions: false })
                .then(result => {
                    this.vegaView = result.view;
                    this.setupVegaListeners();
                    console.log('>>> Chart rendered.');
                })
                .catch(console.error);
        }
    }
    
    /**
     * Finds the data stream names for all dynamic layers (zones, grids) 
     * and overwrites the initial coordinates in the spec datasets.
     */
    private injectVegaDataNames(spec: any): any {
        this.baseZoneDataName = undefined;
        this.dynamicZoneDataName = undefined;
        this.verticalGridDataName = undefined;
        this.horizontalGridDataName = undefined;

        // 1. Identify Data Names from the spec's layers
        if (spec.layer && Array.isArray(spec.layer)) {
            for (const layer of spec.layer) {
                if (layer.mark && layer.data && layer.data.name) {
                    // Zones
                    if (layer.mark.type === 'rect') {
                        if (layer.mark.stroke === 'gray' && !this.baseZoneDataName) {
                            this.baseZoneDataName = layer.data.name;
                        } else if (layer.mark.stroke === 'red' && !this.dynamicZoneDataName) {
                            this.dynamicZoneDataName = layer.data.name;
                        }
                    } 
                    // Grids (rules)
                    else if (layer.mark.type === 'rule' && spec.datasets[layer.data.name]) {
                        const data = spec.datasets[layer.data.name];
                        if (data.some((d: any) => d.id === 'vertical_grid_1')) {
                            this.verticalGridDataName = layer.data.name;
                        } else if (data.some((d: any) => d.id === 'horizontal_grid_1')) {
                            this.horizontalGridDataName = layer.data.name;
                        }
                    }
                }
            }
        }

        // 2. Modify the data inside the top-level 'datasets' object for initial render
        if (spec.datasets) {
            this.modifyDatasetCoordinates(spec.datasets, this.baseZoneDataName, this.currentBaseZoneBtm, this.currentBaseZoneTop);
            this.modifyDatasetCoordinates(spec.datasets, this.dynamicZoneDataName, this.currentDynamicZoneBtm, this.currentDynamicZoneTop);
            
            // NOTE: Vertical Grid initial update is tricky as it needs both y and y2 (top/btm)
            // It's safer to rely on the Vega update in reactToBatterChange for the grids.
            // If the horizontal grid is static, it doesn't need data name, but since it's dynamic, we found its name.
        }

        return spec;
    }

    /** Helper to modify zone data in the spec */
    private modifyDatasetCoordinates(datasets: any, name: string | undefined, btm: number, top: number): boolean {
        if (name && Array.isArray(datasets[name]) && datasets[name].length > 0) {
            // Zone data should only have one row
            datasets[name][0].y = btm;
            datasets[name][0].y2 = top;
            return true;
        }
        return false;
    }

    // --- DYNAMIC UPDATE LOGIC ---

    /**
     * Looks up the correct strike zone coordinates based on current filters 
     * and calculates the 3x3 grid coordinates.
     */
    private updateStrikeZoneCoordinates(): void {
        if (this.strikeZoneData.length === 0) return;

        // 1. DETERMINE BASE ZONE (TEAM/OPPONENT TEAM AVERAGE)
        let baseLookupEntry: StrikeZoneData | undefined;
        const allEntry = this.strikeZoneData.find(d => d.entity_type === 'ALL');

        // Determine the team code for the base zone (Lotte for offense, Opponent for defense)
        const teamCode = (this.playerType === 'batters') ? LOTTE_TEAM_CODE : this.opponentTeam;
        
        baseLookupEntry = this.strikeZoneData.find(
            d => d.entity_type === 'TEAM' && d.entity_name === teamCode
        );

        const finalBaseEntry = baseLookupEntry || allEntry;
        if (finalBaseEntry) {
            this.currentBaseZoneTop = finalBaseEntry.avg_strikezone_top;
            this.currentBaseZoneBtm = finalBaseEntry.avg_strikezone_btm;
        } else {
            this.currentBaseZoneTop = DEFAULT_ZONE_TOP; this.currentBaseZoneBtm = DEFAULT_ZONE_BTM;
        }

        // 2. DETERMINE DYNAMIC ZONE (INDIVIDUAL BATTER)
        if (this.selectedBatter && this.selectedBatter !== 'ALL') {
            const dynamicLookupEntry = this.strikeZoneData.find(
                d => d.entity_type === 'BATTER' && d.entity_name === this.selectedBatter
            );
            
            const finalDynamicEntry = dynamicLookupEntry || finalBaseEntry;
            
            if (finalDynamicEntry) {
                this.currentDynamicZoneTop = finalDynamicEntry.avg_strikezone_top;
                this.currentDynamicZoneBtm = finalDynamicEntry.avg_strikezone_btm;
            } else {
                this.currentDynamicZoneTop = DEFAULT_ZONE_TOP;
                this.currentDynamicZoneBtm = DEFAULT_ZONE_BTM;
            }
        } else {
            // HIDE the dynamic zone when 'All Batters' is selected (by setting height to zero)
            this.currentDynamicZoneTop = 0.0;
            this.currentDynamicZoneBtm = 0.0;
        }

        // 3. CALCULATE GRID LINES (based on dynamic zone height)
        const szHeight = this.currentDynamicZoneTop - this.currentDynamicZoneBtm;
        const szThirdY = szHeight / 3.0;

        this.currentGridY1 = this.currentDynamicZoneBtm + szThirdY;
        this.currentGridY2 = this.currentDynamicZoneBtm + (2 * szThirdY);
        
        // Log coordinates for confirmation (optional, for debugging)
        console.log(`Dynamic Zone for ${this.selectedBatter}: [${this.currentDynamicZoneBtm}, ${this.currentDynamicZoneTop}]`);
    }

    /**
     * Attaches signal listeners to the active Vega view.
     */
    private setupVegaListeners(): void {
        if (!this.vegaView) return;

        // The signal that changes the batter (and thus the strike zone)
        this.vegaView.addSignalListener('BatterSelector_batter_name', (name: string, value: string) => {
            this.reactToBatterChange(value);
        });

        // The signal that changes the pitcher (affects scatter plot filtering only)
        // If the signal name is 'OpponentPitcherSelector_pitcher_name' in the defense mode, 
        // you might need conditional logic here based on this.playerType.
        this.vegaView.addSignalListener('PitcherSelector_pitcher_name', (name: string, value: string) => {
            this.selectedBatter = value; // Update Angular state (no strike zone change needed)
        });
    }

    /**
     * Reacts to a batter selection change from the Vega dropdown 
     * by recalculating coordinates and pushing them to the view.
     */
    reactToBatterChange(batterName: string): void {
        this.selectedBatter = batterName;
        this.updateStrikeZoneCoordinates();

        if (!this.vegaView || !this.baseZoneDataName || !this.dynamicZoneDataName || !this.horizontalGridDataName || !this.verticalGridDataName) {
            console.warn('Vega view or necessary data names not ready. Cannot push strike zone update.');
            return;
        }

        const vegaChangeset: any = (vegaEmbed as any).vega.changeset; 
        
        // --- 1. PREPARE NEW DATA ---
        
        // Dynamic Zone (Individual)
        const dynamicDatum = {
            id: 'dynamic_zone', x: -HALF_PLATE_WIDTH, x2: HALF_PLATE_WIDTH, 
            y: this.currentDynamicZoneBtm, y2: this.currentDynamicZoneTop 
        };
        const dynamicChanges = vegaChangeset().remove((d: any) => d.id === 'dynamic_zone').insert(dynamicDatum);
        
        // Base Zone (Team Average)
        const baseDatum = {
            id: 'base_zone', x: -HALF_PLATE_WIDTH, x2: HALF_PLATE_WIDTH,
            y: this.currentBaseZoneBtm, y2: this.currentBaseZoneTop 
        };
        const baseChanges = vegaChangeset().remove((d: any) => d.id === 'base_zone').insert(baseDatum);

        // Vertical Grid (Moves vertically with the dynamic zone)
        const verticalGridData = [
            { id: 'vertical_grid_1', y: this.currentDynamicZoneBtm, y2: this.currentDynamicZoneTop, x_center: -ONE_THIRD_PLATE_WIDTH },
            { id: 'vertical_grid_2', y: this.currentDynamicZoneBtm, y2: this.currentDynamicZoneTop, x_center: ONE_THIRD_PLATE_WIDTH }
        ];
        const verticalGridChanges = vegaChangeset().remove((d: any) => d.id.startsWith('vertical_grid')).insert(verticalGridData);

        // Horizontal Grid (Moves and stretches with the dynamic zone)
        const horizontalGridData = [
            { id: 'horizontal_grid_1', x: -HALF_PLATE_WIDTH, x2: HALF_PLATE_WIDTH, y_center: this.currentGridY1 },
            { id: 'horizontal_grid_2', x: -HALF_PLATE_WIDTH, x2: HALF_PLATE_WIDTH, y_center: this.currentGridY2 }
        ];
        const horizontalGridChanges = vegaChangeset().remove((d: any) => d.id.startsWith('horizontal_grid')).insert(horizontalGridData);


        // --- 2. CHAIN ASYNC UPDATES ---
        this.vegaView.runAfter(() => {
            this.vegaView.change(this.dynamicZoneDataName, dynamicChanges).runAsync()
                .then(() => this.vegaView.change(this.baseZoneDataName, baseChanges).runAsync())
                .then(() => this.vegaView.change(this.verticalGridDataName, verticalGridChanges).runAsync())
                .then(() => this.vegaView.change(this.horizontalGridDataName, horizontalGridChanges).runAsync())
                .then(() => {
                    console.log(`Pushed dynamic update for batter ${batterName}.`);
                })
                .catch(console.error);
        });
    }

    /**
     * Manually prints the current internal state of the Vega view,
     * including active filter parameters, for debugging.
     */
    printCurrentVegaState(): void {
        if (!this.vegaView) {
            console.warn('Vega view not yet available to print state.');
            return;
        }

        try {
            const currentState = this.vegaView.getState();

            console.log('[FINAL DEBUG] Vega Internal State (Manual Check):', currentState);
            console.log('--- Selector Values ---');
            console.log(`BatterSelector Value:`, currentState.signals?.BatterSelector || currentState.data?.BatterSelector);
            console.log(`PitcherSelector Value:`, currentState.signals?.PitcherSelector || currentState.data?.PitcherSelector);
            console.log('-----------------------');
        } catch (e) {
            console.error('Error reading Vega state:', e);
        }

        this.vegaView.run();
    }
}