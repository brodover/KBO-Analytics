import { Component, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import * as vegaEmbed from 'vega-embed';

const CHART_SPEC_PATH = 'assets/20250322LTLG02025_plate_discipline.json'; 

@Component({
  selector: 'app-pitch-chart',
  templateUrl: './pitch-chart.html',
  styleUrl: './pitch-chart.css'
})
export class PitchChart implements AfterViewInit {
  // Use @ViewChild to get a reference to the HTML div container
  @ViewChild('chartContainer', { static: false }) chartContainer!: ElementRef;

  constructor() { }

  ngAfterViewInit(): void {
    // 1. Fetch the Vega-Lite JSON specification
    fetch(CHART_SPEC_PATH)
      .then(res => res.json())
      .then(spec => {
        // 2. Embed the visualization into the DOM element
        // The first argument is the CSS selector for the container.
        // We use the ElementRef's nativeElement to get the DOM element.
        vegaEmbed.default(this.chartContainer.nativeElement, spec, {
            // Optional: Customize embedding options
            actions: false // Disable the default 'View Source', 'Open Editor' links
        })
        .catch(console.error);
      })
      .catch(err => console.error("Could not load chart specification:", err));
  }
}