import { HttpClient } from '@angular/common/http';
import { Component, AfterViewInit, ElementRef, ViewChild, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as vegaEmbed from 'vega-embed';
import { StrikeZoneData } from '../interfaces/strike-zone-data';

@Component({
    selector: 'app-pitch-chart',
    templateUrl: './pitch-chart.html',
    styleUrl: './pitch-chart.css',
    imports: [
        CommonModule,
        FormsModule
    ],
})

export class PitchChart implements AfterViewInit {
    private strikeZoneData: StrikeZoneData[] = [];
    private pitchData: any = null;
    private vegaView: any = null;

    // Use @ViewChild to get a reference to the HTML div container
    @ViewChild('chartContainer', { static: false }) chartContainer!: ElementRef;

    private selectedBatter: string = 'ALL';
    private selectedPitcher: string = 'ALL';

    private baseZoneName: string | undefined = '';
    private dynamicZoneName: string | undefined = '';
    private verticalGridDataName: string | undefined = '';
    private horizontalGridDataName: string | undefined = '';

    currentGridX1: number = 0;
    currentGridX2: number = 0;

    currentGridY1: number = 0;
    currentGridY2: number = 0;

    // Base Zone coordinates (for the team/opponent team average)
    currentBaseZoneTop: number = 3.4;
    currentBaseZoneBtm: number = 1.6;

    // Dynamic Zone coordinates (for the selected individual batter)
    currentDynamicZoneTop: number = 3.4;
    currentDynamicZoneBtm: number = 1.6;

    // State variables for the selections
    playerType: 'batters' | 'pitchers' = 'batters'; // Default to batters
    opponentTeam: string = 'HH'; // Default to the first team
    opponentTeams: string[] = ['HH', 'HT', 'KT', 'LG', 'NC', 'OB', 'SK', 'SS', 'WO'];

    constructor(@Inject(PLATFORM_ID) private platformId: Object, private el: ElementRef, private http: HttpClient) { }

    ngAfterViewInit(): void {
        // 1. Fetch the strike zone data asynchronously
        this.fetchStrikeZoneData().then(() => {
            // 2. Load the main pitch chart after the strike zone data is ready
            this.loadChart();
        });
    }

    /**
     * Fetches the strike zone summary data.
     */
    fetchStrikeZoneData(): Promise<void> {
        return new Promise((resolve) => {
            this.http.get<StrikeZoneData[]>(`assets/strikezone_summary.json`).subscribe({
                next: (data) => {
                    this.strikeZoneData = data;
                    resolve();
                },
                error: (err) => {
                    console.error('Error fetching strike zone data', err);
                    resolve(); // Resolve anyway to proceed with chart loading
                }
            });
        });
    }

    /**
     * Constructs the filename and fetches/renders the Altair chart.
     */
    loadChart(): void {
        if (isPlatformBrowser(this.platformId)) {
            // 1. Construct the filename based on current selections
            const filename = `LT_${this.playerType}_vs_${this.opponentTeam}_discipline.json`;
            const chartUrl = `assets/${filename}`;

            console.log('>>> Attempting to load chart:', chartUrl);

            // 2. Fetch the Altair/Vega-Lite JSON specification
            this.http.get(chartUrl).subscribe({
                next: (data: any) => {
                    this.pitchData = data; // <-- Store the spec
                    this.renderChart();
                },
                error: (err) => {
                    console.error('Failed to load chart JSON:', err);
                }
            });
        } else {
            console.log('Skipping Vega-Embed execution on the server side.');
        }
    }

    /**
     * Renders the Vega-Lite/Altair specification after injecting dynamic data.
     */
    renderChart(): void {
        this.updateStrikeZone();

        if (!this.pitchData)
            return;
        
        const container = this.el.nativeElement.querySelector('#vega-chart-container');
        if (container) {
            const updatedPitchData = this.injectStrikeZoneCoordinates(this.pitchData);

            container.innerHTML = '';
            vegaEmbed.default(container, updatedPitchData, { actions: false })
                .then(result => {
                    this.vegaView = result.view;
                    this.setupVegaListeners();
                    console.log('>>> Chart rendered.');
                })
                .catch(console.error);
        }
    }

    /**
     * Looks up the correct strike zone (top/bottom) based on current filters.
     */
    updateStrikeZone(): void {
        if (this.strikeZoneData.length === 0) return;

        // --- 1. DETERMINE BASE ZONE (TEAM/OPPONENT TEAM AVERAGE) ---
        let baseLookupEntry: StrikeZoneData | undefined;
        const allEntry = this.strikeZoneData.find(d => d.entity_type === 'ALL');

        if (this.playerType === 'pitchers') {
            // Base Zone: Opponent Team Average
            baseLookupEntry = this.strikeZoneData.find(
                d => d.entity_type === 'TEAM' && d.entity_name === this.opponentTeam
            );
        } else if (this.playerType === 'batters') {
            // Base Zone: Lotte Team Average
            baseLookupEntry = this.strikeZoneData.find(
                d => d.entity_type === 'TEAM' && d.entity_name === 'LT'
            );
        }

        // Apply Base Zone values, falling back to 'ALL'
        const finalBaseEntry = baseLookupEntry || allEntry;
        if (finalBaseEntry) {
            this.currentBaseZoneTop = finalBaseEntry.avg_strikezone_top;
            this.currentBaseZoneBtm = finalBaseEntry.avg_strikezone_btm;
        } else {
            // Failsafe 1: Set base to a default (should not happen)
            this.currentBaseZoneTop = 3.4; this.currentBaseZoneBtm = 1.6;
        }

        console.log(`Base Zone set to [${this.selectedBatter}, ${this.currentBaseZoneBtm}, ${this.currentBaseZoneTop}]`);
        // --- 2. DETERMINE DYNAMIC ZONE (INDIVIDUAL BATTER) ---
        if (this.selectedBatter !== 'ALL') {
            const dynamicLookupEntry = this.strikeZoneData.find(
                d => d.entity_type === 'BATTER' && d.entity_name === this.selectedBatter
            );

            console.log(`Dynamic Lookup Entry for `, dynamicLookupEntry, finalBaseEntry);
            // Use batter's zone if available, otherwise fall back to the Base Zone
            const finalDynamicEntry = dynamicLookupEntry || finalBaseEntry;

            // This block MUST execute to update the coordinates away from 0.0
            if (finalDynamicEntry) {
                this.currentDynamicZoneTop = finalDynamicEntry.avg_strikezone_top;
                this.currentDynamicZoneBtm = finalDynamicEntry.avg_strikezone_btm;
            } else {
                // Failsafe 2: If somehow both lookups fail, reset to defaults instead of 0.0
                this.currentDynamicZoneTop = 3.4;
                this.currentDynamicZoneBtm = 1.6;
            }
        } else {
            // HIDE the dynamic zone when 'All Batters' is selected
            this.currentDynamicZoneTop = 0.0;
            this.currentDynamicZoneBtm = 0.0;
        }

        const szHeight = this.currentDynamicZoneTop - this.currentDynamicZoneBtm;
        const szThirdY = szHeight / 3.0;

        // Calculate the new 1/3 and 2/3 horizontal grid line heights
        this.currentGridY1 = this.currentDynamicZoneBtm + szThirdY;
        this.currentGridY2 = this.currentDynamicZoneBtm + (2 * szThirdY);
    }

    /**
     * Overwrites the strike zone data arrays for both the base and dynamic layers by
     * modifying the coordinates inside the top-level 'datasets' object.
     */
    injectStrikeZoneCoordinates(pitchData: any): any {
        // 1. Identify the data names associated with the strike zone layers
        if (pitchData.layer && Array.isArray(pitchData.layer)) {
            for (const layer of pitchData.layer) {
                // Check if it's a rect mark and has a data name
                if (layer.mark && layer.mark.type === 'rect' && layer.data && layer.data.name) {

                    // Base Zone is the gray one, Dynamic Zone is the red one
                    if (layer.mark.stroke === 'gray' && !this.baseZoneName) {
                        this.baseZoneName = layer.data.name;
                    } else if (layer.mark.stroke === 'red' && !this.dynamicZoneName) {
                        this.dynamicZoneName = layer.data.name;
                    }

                    if (this.baseZoneName && this.dynamicZoneName) {
                        break; // Both names found
                    }
                }
            }
        }

        // 2. Modify the data inside the top-level 'datasets' object
        // Note: spec.datasets is where Altair places the named data arrays.
        let baseZoneModified = false;
        let dynamicZoneModified = false;

        if (pitchData.datasets) {
            // Modify Base Zone Data
            if (this.baseZoneName && Array.isArray(pitchData.datasets[this.baseZoneName])) {
                const baseLayerData = pitchData.datasets[this.baseZoneName];
                if (baseLayerData.length > 0) {
                    // The strike zone data should only have one row
                    baseLayerData[0].y = this.currentBaseZoneBtm;
                    baseLayerData[0].y2 = this.currentBaseZoneTop;
                    baseZoneModified = true;
                }
            }

            // Modify Dynamic Zone Data
            if (this.dynamicZoneName && Array.isArray(pitchData.datasets[this.dynamicZoneName])) {
                const dynamicLayerData = pitchData.datasets[this.dynamicZoneName];
                if (dynamicLayerData.length > 0) {
                    // The strike zone data should only have one row
                    dynamicLayerData[0].y = this.currentDynamicZoneBtm;
                    dynamicLayerData[0].y2 = this.currentDynamicZoneTop;
                    dynamicZoneModified = true;
                }
            }
        }

        const verticalGridDataName = Object.keys(pitchData.datasets).find(name => {
            const data = pitchData.datasets[name];
            return Array.isArray(data) && 
                data.length > 0 && 
                data.some(d => d.id === 'vertical_grid_1' || d.id === 'vertical_grid_2');
        });

        if (verticalGridDataName) {
            this.verticalGridDataName = verticalGridDataName;
        }

        const horizontalGridDataName = Object.keys(pitchData.datasets).find(name => {
            const data = pitchData.datasets[name];
            return Array.isArray(data) && 
                data.length > 0 && 
                data.some(d => d.id === 'horizontal_grid_1' || d.id === 'horizontal_grid_2');
        });

        if (horizontalGridDataName) {
            this.horizontalGridDataName = horizontalGridDataName;
        }

        // 3. Final status check
        if (!baseZoneModified || !dynamicZoneModified) {
            console.warn('⚠️ WARNING: Could not modify data for both strike zone layers. Check JSON for "datasets" property.');
        }

        return pitchData;
    }

    /**
     * Attaches signal listeners to the active Vega view.
     */
    setupVegaListeners(): void {
        if (!this.vegaView) return;

        // Listen for the BATTER dropdown
        this.vegaView.addSignalListener('BatterSelector_batter_name', (name: string, value: string) => {
            // 'value' is the selected name
            console.log(`Vega batter selection changed to: ${value}`);

            // This is the main "react" function
            this.reactToBatterChange(value);
        });

        // Listen for the PITCHER dropdown
        this.vegaView.addSignalListener('PitcherSelector_pitcher_name', (name: string, value: string) => {
            // 'value' is the selected name
            console.log(`Vega pitcher selection changed to: ${value}`);

            // Just update the Angular property. No strike zone change is needed.
            this.selectedPitcher = value;
        });
    }

    /**
     * Reacts to a batter selection change from the Vega dropdown.
     * 1. Updates Angular state.
     * 2. Recalculates strike zone.
     * 3. Pushes new coordinates back into Vega.
     */
    /**
     * Reacts to a batter selection change from the Vega dropdown.
     */
    reactToBatterChange(batterName: string): void {
        // 1. Update Angular's state
        this.selectedBatter = batterName;

        // 2. Recalculate strike zone coordinates (updates this.currentDynamicZoneTop/Btm, etc.)
        this.updateStrikeZone();

        // 3. PUSH NEW COORDINATES TO VEGA using direct data access
        if (!this.vegaView || !this.baseZoneName || !this.dynamicZoneName) {
            console.warn('Vega view or zone data names not ready. Cannot push strike zone update.');
            return;
        }

        const vegaChangeset: any = vegaEmbed.vega.changeset; 

        const dynamicDatum = {
            id: 'dynamic_zone', 
            x: -0.708, x2: 0.708, 
            y: this.currentDynamicZoneBtm, 
            y2: this.currentDynamicZoneTop 
        };
        const dynamicChanges = vegaChangeset()
            .remove((d: any) => d.id === 'dynamic_zone') 
            .insert(dynamicDatum);                       
        
        const baseDatum = {
            id: 'base_zone', 
            x: -0.708, x2: 0.708,
            y: this.currentBaseZoneBtm, 
            y2: this.currentBaseZoneTop 
        };
        const baseChanges = vegaChangeset()
            .remove((d: any) => d.id === 'base_zone') 
            .insert(baseDatum);                      

        const verticalGridData = [
            { id: 'vertical_grid_1', y: this.currentDynamicZoneBtm, y2: this.currentDynamicZoneTop, x_center: -0.236 },
            { id: 'vertical_grid_2', y: this.currentDynamicZoneBtm, y2: this.currentDynamicZoneTop, x_center: 0.236 }
        ];
        const verticalGridChanges = vegaChangeset()
            .remove((d: any) => d.id === 'vertical_grid_1' || d.id === 'vertical_grid_2') 
            .insert(verticalGridData);

        const horizontalGridData = [
            { id: 'horizontal_grid_1', x: -0.708, x2: 0.708, y_center: this.currentGridY1 },
            { id: 'horizontal_grid_2', x: -0.708, x2: 0.708, y_center: this.currentGridY2 }
        ];
        const horizontalGridChanges = vegaChangeset()
            .remove((d: any) => d.id === 'horizontal_grid_1' || d.id === 'horizontal_grid_2') 
            .insert(horizontalGridData);

        this.vegaView.change(this.dynamicZoneName, dynamicChanges).runAsync()
            .then(() => {
                return this.vegaView.change(this.baseZoneName, baseChanges).runAsync();
            })
            .then(() => {
                return this.vegaView.change(this.verticalGridDataName, verticalGridChanges).runAsync();
            })
            .then(() => {
                return this.vegaView.change(this.horizontalGridDataName, horizontalGridChanges).runAsync();
            })
            .then(() => {
                console.log(`Pushed strike zone update for ${batterName}.`);
            })
            .catch(console.error);
    
        console.log(`Pushed strike zone update for ${batterName}: [${this.currentDynamicZoneBtm}, ${this.currentDynamicZoneTop}]`);
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