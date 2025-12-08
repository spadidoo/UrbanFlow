# backend/services/pdf_generator.py
# ✅ FIXED VERSION - All Layout & Formatting Issues Resolved

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, 
    PageBreak, Image, KeepTogether
)
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.graphics.charts.linecharts import HorizontalLineChart
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.legends import Legend
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from io import BytesIO
from datetime import datetime
import json

class EnhancedPDFReportGenerator:
    """
    ✅ FIXED: Professional PDF Reports with Clean Layout
    - Fixed "Worst Hours" formatting (no line breaks)
    - Charts stay together with headers (no page splits)
    - Removed black boxes from charts
    - Fixed max delay calculation and display
    - Improved spacing throughout
    - Clean axis labels on charts
    """
    
    # Color Palette (matching UI)
    COLORS = {
        'primary': colors.HexColor('#F97316'),
        'light_green': colors.HexColor('#22c55e'),
        'moderate_yellow': colors.HexColor('#eab308'),
        'heavy_red': colors.HexColor('#ef4444'),
        'blue': colors.HexColor('#3b82f6'),
        'purple': colors.HexColor('#a855f7'),
        'gray_light': colors.HexColor('#f3f4f6'),
        'gray_dark': colors.HexColor('#6b7280'),
        'text_dark': colors.HexColor('#1f2937'),
    }
    
    def __init__(self, simulation_data: dict):
        """Initialize with complete simulation data"""
        self.sim_data = simulation_data
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
        self._extract_and_validate_data()
    
    def _setup_custom_styles(self):
        """Create custom styles matching UI"""
        self.styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=self.COLORS['text_dark'],
            spaceAfter=12,
            alignment=TA_LEFT,
            fontName='Helvetica-Bold'
        ))
        
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=16,
            textColor=self.COLORS['text_dark'],
            spaceAfter=8,
            spaceBefore=12,
            fontName='Helvetica-Bold'
        ))
        
        self.styles.add(ParagraphStyle(
            name='KPITitle',
            fontSize=10,
            textColor=self.COLORS['gray_dark'],
            spaceAfter=4,
            fontName='Helvetica'
        ))
        
        self.styles.add(ParagraphStyle(
            name='KPIValue',
            fontSize=20,
            textColor=self.COLORS['text_dark'],
            spaceAfter=2,
            fontName='Helvetica-Bold'
        ))
    
    def _extract_and_validate_data(self):
        """Extract all data from simulation"""
        self.hourly_data = self.sim_data.get('hourly_predictions', [])
        
        if isinstance(self.hourly_data, str):
            try:
                self.hourly_data = json.loads(self.hourly_data)
            except:
                self.hourly_data = []
        
        self.agg_view = self.sim_data.get('aggregated_view', {})
        if isinstance(self.agg_view, str):
            try:
                self.agg_view = json.loads(self.agg_view)
            except:
                self.agg_view = {}
        
        self.time_segments = self.sim_data.get('time_segments_data', {}) or self.sim_data.get('time_segments', {})
        if isinstance(self.time_segments, str):
            try:
                self.time_segments = json.loads(self.time_segments)
            except:
                self.time_segments = {}
        
        self._calculate_summary_metrics()
        
        print("Extracted Data:")
        print(f"  - Hourly predictions: {len(self.hourly_data)}")
        print(f"  - Has aggregated view: {bool(self.agg_view)}")
        print(f"  - Time segments: {list(self.time_segments.keys())}")
        print(f"  - Summary metrics calculated: {bool(self.summary)}")
        print(f"  - Max delay: {self.summary.get('max_delay_minutes', 0)} min")
    
    def _calculate_summary_metrics(self):
        """
        ✅ CRITICAL FIX: Calculate summary from hourly data
        Prevents 0-valued metrics
        """
        if not self.hourly_data:
            self.summary = {
                'total_hours': 0,
                'avg_severity': 0,
                'avg_delay_minutes': 0,
                'max_delay_minutes': 0,
                'light_hours': 0,
                'moderate_hours': 0,
                'heavy_hours': 0,
                'peak_hours': [],
                'worst_hour': None
            }
            return
        
        total_hours = len(self.hourly_data)
        
        # Count severity categories and calculate averages
        light_hours = sum(1 for h in self.hourly_data if h.get('severity', 0) < 0.5)
        moderate_hours = sum(1 for h in self.hourly_data if 0.5 <= h.get('severity', 0) < 1.5)
        heavy_hours = sum(1 for h in self.hourly_data if h.get('severity', 0) >= 1.5)
        
        severities = [h.get('severity', 0) for h in self.hourly_data]
        avg_severity = sum(severities) / len(severities) if severities else 0
        
        # ✅ FIXED: Calculate delays properly
        delays = []
        for h in self.hourly_data:
            if not isinstance(h, dict):
                delays.append(0.0)
                continue
            delay_info = h.get('delay_info', {})
            if isinstance(delay_info, dict):
                try:
                    dval = delay_info.get('additional_delay_min', 0)
                    dval = float(dval) if dval is not None and dval != '' else 0.0
                except Exception:
                    dval = 0.0
                delays.append(dval)
            else:
                delays.append(0.0)
        
        avg_delay = sum(delays) / len(delays) if delays else 0
        max_delay = max(delays) if delays else 0
        
        # Find peak hours (heavy congestion)
        peak_hours = []
        for h in self.hourly_data:
            if h.get('severity', 0) >= 1.5:
                hour = h.get('hour', h.get('datetime', '').split('T')[1].split(':')[0] if 'T' in h.get('datetime', '') else 0)
                peak_hours.append(str(hour))
        
        # Find worst hour
        worst_hour = max(self.hourly_data, key=lambda x: x.get('severity', 0)) if self.hourly_data else None
        
        self.summary = {
            'total_hours': total_hours,
            'avg_severity': round(avg_severity, 2),
            'avg_severity_label': self._get_severity_label(avg_severity),
            'avg_delay_minutes': round(avg_delay, 1),
            'max_delay_minutes': round(max_delay, 1),
            'light_hours': light_hours,
            'moderate_hours': moderate_hours,
            'heavy_hours': heavy_hours,
            'light_percentage': round((light_hours / total_hours * 100)) if total_hours > 0 else 0,
            'moderate_percentage': round((moderate_hours / total_hours * 100)) if total_hours > 0 else 0,
            'heavy_percentage': round((heavy_hours / total_hours * 100)) if total_hours > 0 else 0,
            'peak_hours': peak_hours,
            'worst_hour': worst_hour,
            'duration_days': round(total_hours / 24, 1)
        }
    
    def _get_severity_label(self, severity):
        """Convert numeric severity to label"""
        if severity < 0.5:
            return "Light"
        elif severity < 1.5:
            return "Moderate"
        else:
            return "Heavy"
    
    def _get_severity_color(self, severity):
        """Get color for severity level"""
        if isinstance(severity, str):
            severity_map = {'light': 0.3, 'moderate': 1.0, 'heavy': 2.0}
            severity = severity_map.get(severity.lower(), 1.0)
        
        if severity < 0.5:
            return self.COLORS['light_green']
        elif severity < 1.5:
            return self.COLORS['moderate_yellow']
        else:
            return self.COLORS['heavy_red']
    
    def generate_pdf(self, filename: str = None) -> BytesIO:
        """Generate complete visual PDF report"""
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=0.5*inch,
            leftMargin=0.5*inch,
            topMargin=0.75*inch,
            bottomMargin=0.5*inch
        )
        
        elements = []
        
        # 1. Header
        elements.extend(self._build_header())
        elements.append(Spacer(1, 0.25*inch))
        
        # 2. KPI Cards
        elements.extend(self._build_kpi_cards())
        elements.append(Spacer(1, 0.2*inch))
        
        # 3. Peak Congestion Analysis
        elements.extend(self._build_peak_analysis())
        elements.append(Spacer(1, 0.2*inch))
        
        # 4. Severity Chart (kept together with header)
        elements.extend(self._build_severity_chart())
        elements.append(Spacer(1, 0.15*inch))
        
        # 5. Delay Chart (kept together with header)
        elements.extend(self._build_delay_chart())
        elements.append(Spacer(1, 0.2*inch))
        
        # 6. Time of Day Analysis
        elements.extend(self._build_time_of_day_analysis())
        elements.append(PageBreak())
        
        # 7. Day-by-Day Summary
        if self.summary['duration_days'] > 1:
            elements.extend(self._build_day_by_day_summary())
            elements.append(Spacer(1, 0.2*inch))
        
        # 8. Hour-by-Hour Table
        elements.extend(self._build_hourly_breakdown_table())
        
        # Build PDF
        doc.build(elements)
        buffer.seek(0)
        
        print(f"✅ PDF generated successfully - Size: {len(buffer.getvalue())} bytes")
        
        return buffer
    
    def _build_header(self):
        """Build report header"""
        elements = []
        
        title = Paragraph(
            f"<b>Traffic Disruption Analysis Report</b>",
            self.styles['CustomTitle']
        )
        elements.append(title)
        
        sim_name = self.sim_data.get('simulation_name', 'Unnamed Simulation')
        location = self.sim_data.get('disruption_location', 'Unknown Location')
        disruption_type = self.sim_data.get('disruption_type', 'Unknown')
        
        start_time = self.sim_data.get('start_time', '')
        end_time = self.sim_data.get('end_time', '')
        
        start_str = 'N/A'
        end_str = 'N/A'
        
        if start_time:
            try:
                if hasattr(start_time, 'strftime'):
                    start_dt = start_time
                else:
                    start_dt = datetime.fromisoformat(str(start_time).replace('Z', '+00:00'))
                start_str = start_dt.strftime('%B %d, %Y %I:%M %p')
            except:
                start_str = str(start_time) if start_time else 'N/A'
        
        if end_time:
            try:
                if hasattr(end_time, 'strftime'):
                    end_dt = end_time
                else:
                    end_dt = datetime.fromisoformat(str(end_time).replace('Z', '+00:00'))
                end_str = end_dt.strftime('%B %d, %Y %I:%M %p')
            except:
                end_str = str(end_time) if end_time else 'N/A'
        
        metadata_text = f"""
        <font size=10 color="#6b7280">
        <b>Scenario:</b> {sim_name}<br/>
        <b>Location:</b> {location}<br/>
        <b>Type:</b> {disruption_type.title()}<br/>
        <b>Period:</b> {start_str} to {end_str}<br/>
        <b>Generated:</b> {datetime.now().strftime('%B %d, %Y at %I:%M %p')}
        </font>
        """
        
        metadata = Paragraph(metadata_text, self.styles['Normal'])
        elements.append(metadata)
        
        return elements
    
    def _build_kpi_cards(self):
        """✅ Build visual KPI cards with proper formatting"""
        elements = []
        
        header = Paragraph("<b>Key Performance Indicators</b>", self.styles['SectionHeader'])
        elements.append(header)
        elements.append(Spacer(1, 0.1*inch))
        
        # Calculate worst hours range - FIXED formatting with proper spacing
        worst_hours_str = "None"
        if self.summary['peak_hours']:
            peak_hours = sorted(set(int(h) for h in self.summary['peak_hours'] if str(h).isdigit()))
            if peak_hours:
                # Format properly: "6:00 - 19:00" with non-breaking space
                start_hour = f"{peak_hours[0]:02d}:00"
                end_hour = f"{peak_hours[-1]:02d}:00"
                # Use non-breaking unicode space to prevent line breaks
                worst_hours_str = f"{start_hour}\u00A0-\u00A0{end_hour}"
        
        # KPI data with proper max delay
        kpis = [
            {
                'title': 'Total Duration',
                'value': f"{self.summary['total_hours']}h",
                'subtitle': f"{self.summary['duration_days']} days",
                'color': self.COLORS['blue'],
                'icon': ''
            },
            {
                'title': 'Average Severity',
                'value': f"{self.summary['avg_severity']}",
                'subtitle': self.summary['avg_severity_label'],
                'color': self._get_severity_color(self.summary['avg_severity']),
                'icon': ''
            },
            {
                'title': 'Max Delay',
                'value': f"+{self.summary['max_delay_minutes']:.0f} min" if self.summary['max_delay_minutes'] > 0 else "0 min",
                'subtitle': f"Avg: +{self.summary['avg_delay_minutes']:.0f} min",
                'color': self.COLORS['heavy_red'],
                'icon': ''
            },
            {
                'title': 'Worst Hours',
                'value': worst_hours_str,
                'subtitle': f"{self.summary['heavy_hours']} heavy hours",
                'color': self.COLORS['purple'],
                'icon': ''
            }
        ]
        
        # Create table for KPI cards
        kpi_table_data = []
        row = []
        
        for kpi in kpis:
            # Create mini-table for each KPI card with better vertical centering
            card_data = [
                [Paragraph(f"<font size=9 color='#6b7280'>{kpi['title']}</font>", self.styles['Normal'])],
                [Paragraph(f"<font size=18 color='#{kpi['color'].hexval()[2:]}'><b>{kpi['value']}</b></font>", self.styles['Normal'])],
                [Paragraph(f"<font size=8 color='#9ca3af'>{kpi['subtitle']}</font>", self.styles['Normal'])]
            ]
            
            # Adjust the width for the Worst Hours card so long times don't wrap
            if kpi['title'] == 'Worst Hours':
                card_col_width = 2.2*inch
                value_font_size = 14  # slightly smaller to fit
            else:
                card_col_width = 1.7*inch
                value_font_size = 18

            # Rebuild card_data with variable font size for value
            card_data = [
                [Paragraph(f"<font size=9 color='#6b7280'>{kpi['title']}</font>", self.styles['Normal'])],
                [Paragraph(f"<font size={value_font_size} color='#{kpi['color'].hexval()[2:]}'><b>{kpi['value']}</b></font>", self.styles['Normal'])],
                [Paragraph(f"<font size=8 color='#9ca3af'>{kpi['subtitle']}</font>", self.styles['Normal'])]
            ]

            card_table = Table(card_data, colWidths=[card_col_width], rowHeights=[0.25*inch, 0.35*inch, 0.2*inch])
            card_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), self.COLORS['gray_light']),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.grey),
                ('ROUNDEDCORNERS', [3, 3, 3, 3])
            ]))
            
            row.append(card_table)
        
        kpi_table_data.append(row)
        
        # Slightly increase the width for the last column (Worst Hours)
        kpi_container = Table(kpi_table_data, colWidths=[1.6*inch, 1.6*inch, 1.6*inch, 2.2*inch], spaceBefore=0, spaceAfter=0)
        kpi_container.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ]))
        
        elements.append(kpi_container)
        
        return elements
    
    def _build_peak_analysis(self):
        """Build Peak Congestion Analysis block"""
        elements = []
        
        peak_hours = self.summary['heavy_hours']
        avg_delay_peak = 0
        
        if self.hourly_data:
            heavy_hours_data = [h for h in self.hourly_data if h.get('severity', 0) >= 1.5]
            if heavy_hours_data:
                delays = []
                for h in heavy_hours_data:
                    delay_info = h.get('delay_info', {})
                    if isinstance(delay_info, dict):
                        try:
                            dval = delay_info.get('additional_delay_min', 0)
                            dval = float(dval) if dval is not None and dval != '' else 0.0
                        except:
                            dval = 0.0
                        delays.append(dval)
                avg_delay_peak = round(sum(delays) / len(delays), 1) if delays else 0
        
        if peak_hours > self.summary['total_hours'] * 0.3:
            insight = "<b>High Impact:</b> More than 30% of hours will have heavy congestion. Consider rescheduling or deploying traffic management."
        elif peak_hours > 0:
            insight = "<b>Moderate Impact:</b> Some hours will experience heavy congestion. Plan alternate routes during peak times."
        else:
            insight = "<b>Low Impact:</b> No severe congestion expected. Traffic should flow relatively smoothly."
        
        peak_data = [
            [Paragraph("<font size=12 color='#991b1b'><b>Peak Congestion Analysis</b></font>", self.styles['Normal'])],
            [Spacer(1, 0.05*inch)],
            [Paragraph(f"<font size=10><b>Worst Traffic Hours:</b> {peak_hours} hours with heavy congestion</font>", self.styles['Normal'])],
            [Paragraph(f"<font size=10><b>Average Delay During Peak:</b> +{avg_delay_peak} minutes</font>", self.styles['Normal'])],
            [Spacer(1, 0.05*inch)],
            [Paragraph(f"<font size=9 color='#6b7280'>{insight}</font>", self.styles['Normal'])]
        ]
        
        peak_table = Table(peak_data, colWidths=[6.5*inch])
        peak_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fee2e2')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('LEFTPADDING', (0, 0), (-1, -1), 15),
            ('RIGHTPADDING', (0, 0), (-1, -1), 15),
            ('BOX', (0, 0), (-1, -1), 1, self.COLORS['heavy_red']),
        ]))
        
        elements.append(peak_table)
        
        return elements
    
    def _build_severity_chart(self):
        """
        ✅ Build severity line chart - FIXED: Keeps with header, no black boxes
        """
        elements = []
        
        header = Paragraph("<b>Severity Over Time</b>", self.styles['SectionHeader'])
        
        if not self.hourly_data or len(self.hourly_data) > 72:
            # Too much data for detailed chart
            elements.append(header)
            elements.append(Spacer(1, 0.05*inch))
            elements.append(Paragraph(
                "<font size=9 color='#6b7280'>Chart omitted for long-duration simulations. See hourly breakdown table for details.</font>",
                self.styles['Normal']
            ))
            return elements
        
        # Prepare data
        hours = list(range(len(self.hourly_data)))
        severities = []
        for h in self.hourly_data:
            try:
                sval = h.get('severity', 0)
                sval = float(sval) if sval is not None and sval != '' else 0.0
            except Exception:
                sval = 0.0
            severities.append(sval)
        
        # Create line chart - SMALLER to fit on page, NO BLACK BOXES
        drawing = Drawing(500, 180)
        
        chart = HorizontalLineChart()
        chart.x = 60
        chart.y = 35
        chart.width = 410
        chart.height = 120
        chart.data = [severities]
        
        # Show fewer labels to avoid crowding
        step = max(1, len(hours) // 12)
        chart.categoryAxis.categoryNames = [str(h) if i % step == 0 else '' for i, h in enumerate(hours)]
        chart.categoryAxis.labels.fontSize = 7
        chart.categoryAxis.labels.angle = 0
        
        # Line styling
        chart.lines[0].strokeColor = self.COLORS['primary']
        chart.lines[0].strokeWidth = 2.5
        chart.lines[0].symbol = None  # Remove markers
        
        # Axis configuration
        chart.valueAxis.valueMin = 0
        chart.valueAxis.valueMax = max(severities) * 1.15 if severities else 2.5
        chart.valueAxis.valueStep = 0.5
        chart.valueAxis.labels.fontSize = 8
        chart.valueAxis.gridStrokeColor = colors.HexColor('#e5e7eb')
        chart.valueAxis.gridStrokeWidth = 0.5
        
        # ✅ REMOVE BLACK BOXES
        chart.strokeColor = None  # No chart border
        chart.fillColor = None  # No background fill
        
        drawing.add(chart)
        
        # Add labels
        drawing.add(String(265, 10, 'Hour', fontSize=8, fillColor=self.COLORS['gray_dark'], textAnchor='middle'))
        drawing.add(String(20, 95, 'Severity', fontSize=8, fillColor=self.COLORS['gray_dark'], textAnchor='middle'))
        
        # ✅ CRITICAL: Use KeepTogether to prevent split
        chart_block = KeepTogether([
            header,
            Spacer(1, 0.08*inch),
            drawing
        ])
        
        elements.append(chart_block)
        
        return elements
    
    def _build_delay_chart(self):
        """
        ✅ Build delay bar chart - FIXED: Better labels, no black boxes, stays together
        """
        elements = []
        
        header = Paragraph("<b>Expected Delays Over Time</b>", self.styles['SectionHeader'])
        
        if not self.hourly_data or len(self.hourly_data) > 72:
            elements.append(header)
            elements.append(Spacer(1, 0.05*inch))
            elements.append(Paragraph(
                "<font size=9 color='#6b7280'>Chart omitted for long-duration simulations.</font>",
                self.styles['Normal']
            ))
            return elements
        
        # Extract delays properly
        delays = []
        for h in self.hourly_data:
            if not isinstance(h, dict):
                delays.append(0.0)
                continue
            delay_info = h.get('delay_info', {})
            if isinstance(delay_info, dict):
                try:
                    dval = delay_info.get('additional_delay_min', 0)
                    dval = float(dval) if dval is not None and dval != '' else 0.0
                except Exception:
                    dval = 0.0
                delays.append(dval)
            else:
                delays.append(0.0)
        
        # Create bar chart - SMALLER with better spacing, NO BLACK BOXES
        drawing = Drawing(500, 180)
        
        chart = VerticalBarChart()
        chart.x = 60
        chart.y = 35
        chart.width = 410
        chart.height = 120
        chart.data = [delays]
        
        # ✅ FIXED: Show fewer, cleaner labels
        step = max(1, len(delays) // 12)
        chart.categoryAxis.categoryNames = [str(h) if i % step == 0 else '' for i, h in enumerate(range(len(delays)))]
        chart.categoryAxis.labels.fontSize = 7
        chart.categoryAxis.labels.angle = 0
        chart.categoryAxis.labels.boxAnchor = 'n'
        
        # Bar styling
        chart.bars[0].fillColor = self.COLORS['heavy_red']
        chart.bars[0].strokeColor = None  # No bar borders
        chart.bars[0].strokeWidth = 0
        
        # Axis configuration
        chart.valueAxis.valueMin = 0
        max_delay_val = max(delays) if delays and max(delays) > 0 else 10
        chart.valueAxis.valueMax = max_delay_val * 1.15
        chart.valueAxis.labels.fontSize = 8
        chart.valueAxis.gridStrokeColor = colors.HexColor('#e5e7eb')
        chart.valueAxis.gridStrokeWidth = 0.5
        
        # ✅ REMOVE BLACK BOXES
        chart.strokeColor = None
        chart.fillColor = None
        
        drawing.add(chart)
        
        # Add labels
        drawing.add(String(265, 10, 'Hour', fontSize=8, fillColor=self.COLORS['gray_dark'], textAnchor='middle'))
        drawing.add(String(15, 95, 'Delay (min)', fontSize=8, fillColor=self.COLORS['gray_dark'], textAnchor='middle'))
        
        # ✅ Keep together
        chart_block = KeepTogether([
            header,
            Spacer(1, 0.08*inch),
            drawing
        ])
        
        elements.append(chart_block)
        
        return elements
    
    def _build_time_of_day_analysis(self):
        """Build Time of Day Analysis section"""
        elements = []
        
        header = Paragraph("<b>When is Traffic Worst?</b>", self.styles['SectionHeader'])
        elements.append(header)
        elements.append(Spacer(1, 0.05*inch))
        
        if not self.time_segments:
            elements.append(Paragraph(
                "<font size=9 color='#6b7280'>Time segment data not available.</font>",
                self.styles['Normal']
            ))
            return elements
        
        periods = ['morning', 'afternoon', 'night']
        period_labels = {
            'morning': 'Morning (6 AM - 12 PM)',
            'afternoon': 'Afternoon (12 PM - 6 PM)',
            'night': 'Night (6 PM - 6 AM)'
        }
        
        period_row = []
        
        for period in periods:
            if period not in self.time_segments:
                continue
            
            data = self.time_segments[period]
            light = data.get('light', 0)
            moderate = data.get('moderate', 0)
            heavy = data.get('heavy', 0)
            
            if heavy > 2:
                insight = f"Expect delays"
            elif moderate > 2:
                insight = "Some slowdowns"
            else:
                insight = "✓ Generally clear"
            
            period_data = [
                [Paragraph(f"<font size=10><b>{period_labels[period]}</b></font>", self.styles['Normal'])],
                [Spacer(1, 0.05*inch)],
                [Paragraph(f"<font size=9>Light: <b>{light}</b> hours</font>", self.styles['Normal'])],
                [Paragraph(f"<font size=9>Moderate: <b>{moderate}</b> hours</font>", self.styles['Normal'])],
                [Paragraph(f"<font size=9>Heavy: <b>{heavy}</b> hours</font>", self.styles['Normal'])],
                [Spacer(1, 0.05*inch)],
                [Paragraph(f"<font size=8 color='#6b7280'>{insight}</font>", self.styles['Normal'])]
            ]
            
            period_table = Table(period_data, colWidths=[2*inch])
            period_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), self.COLORS['gray_light']),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('TOPPADDING', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('RIGHTPADDING', (0, 0), (-1, -1), 10),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            
            period_row.append(period_table)
        
        period_container = Table([period_row], colWidths=[2.1*inch]*3)
        period_container.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        
        elements.append(period_container)
        
        return elements
    
    def _build_day_by_day_summary(self):
        """Day-by-Day summary"""
        elements = []
        
        header = Paragraph("<b>Day-by-Day Summary</b>", self.styles['SectionHeader'])
        elements.append(header)
        elements.append(Spacer(1, 0.1*inch))
        
        if not self.agg_view or 'map_data' not in self.agg_view:
            elements.append(Paragraph(
                "<font size=9 color='#6b7280'>Day-by-day data not available.</font>",
                self.styles['Normal']
            ))
            return elements
        
        map_data = self.agg_view['map_data']
        
        table_data = [
            ['Date/Period', 'Avg Severity', 'Peak Hour', 'Max Delay (min)', 'Impact Level']
        ]
        
        for day in map_data:
            date_str = day.get('date') or day.get('date_range', 'N/A')
            avg_sev = day.get('avg_severity', 0)
            peak_hour = day.get('peak_hour', 'N/A')
            
            max_delay = 0
            day_date = date_str.split(' ')[0] if ' ' in date_str else date_str
            for hour in self.hourly_data:
                hour_datetime = hour.get('datetime', '')
                if day_date in hour_datetime:
                    delay_info = hour.get('delay_info', {})
                    if isinstance(delay_info, dict):
                        delay = delay_info.get('additional_delay_min', 0)
                        max_delay = max(max_delay, delay)
            
            if max_delay == 0:
                max_delay = day.get('max_delay_min', 0)
            
            impact_level = self._get_severity_label(avg_sev)
            
            table_data.append([
                date_str,
                f"{avg_sev:.2f}",
                str(peak_hour),
                f"+{max_delay}",
                impact_level
            ])
        
        day_table = Table(table_data, colWidths=[1.5*inch, 1*inch, 1*inch, 1.2*inch, 1.3*inch])
        day_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), self.COLORS['primary']),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ]))
        
        elements.append(day_table)
        
        return elements
    
    def _build_hourly_breakdown_table(self):
        """Hourly breakdown table"""
        elements = []
        
        header = Paragraph("<b>Hour-by-Hour Detailed Analysis</b>", self.styles['SectionHeader'])
        elements.append(header)
        elements.append(Spacer(1, 0.1*inch))
        
        if not self.hourly_data:
            elements.append(Paragraph(
                "<font size=9 color='#6b7280'>No hourly data available.</font>",
                self.styles['Normal']
            ))
            return elements
        
        display_data = self.hourly_data[:48] if len(self.hourly_data) > 48 else self.hourly_data
        
        table_data = [
            ['Date/Time', 'Day', 'Severity', 'Delay (min)', 'Speed (km/h)', 'Confidence']
        ]
        
        for hour in display_data:
            datetime_str = hour.get('datetime', 'N/A')
            day_of_week = hour.get('day_of_week', 'N/A')
            severity = hour.get('severity', 0)
            severity_label = self._get_severity_label(severity)
            
            delay_info = hour.get('delay_info', {})
            if isinstance(delay_info, dict):
                delay = delay_info.get('additional_delay_min', 0)
                speed = delay_info.get('reduced_speed_kmh', 0)
            else:
                delay = 0
                speed = 0
            
            confidence = hour.get('confidence', 0)
            
            table_data.append([
                datetime_str,
                day_of_week,
                f"{severity:.2f} ({severity_label})",
                f"+{delay}",
                f"{speed}",
                f"{int(confidence * 100)}%"
            ])
        
        hourly_table = Table(table_data, colWidths=[1.3*inch, 0.8*inch, 1.2*inch, 1*inch, 1*inch, 0.7*inch])
        hourly_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), self.COLORS['text_dark']),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('TOPPADDING', (0, 1), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9fafb')])
        ]))
        
        for i, hour in enumerate(display_data, start=1):
            severity = hour.get('severity', 0)
            if severity >= 1.5:
                hourly_table.setStyle(TableStyle([
                    ('BACKGROUND', (2, i), (2, i), colors.HexColor('#fee2e2'))
                ]))
            elif severity >= 0.5:
                hourly_table.setStyle(TableStyle([
                    ('BACKGROUND', (2, i), (2, i), colors.HexColor('#fef3c7'))
                ]))
            else:
                hourly_table.setStyle(TableStyle([
                    ('BACKGROUND', (2, i), (2, i), colors.HexColor('#dcfce7'))
                ]))
        
        elements.append(hourly_table)
        
        if len(self.hourly_data) > 48:
            elements.append(Spacer(1, 0.1*inch))
            elements.append(Paragraph(
                f"<font size=8 color='#6b7280'>Showing first 48 hours. Total: {len(self.hourly_data)} hours.</font>",
                self.styles['Normal']
            ))
        
        return elements


# Export functions
def generate_report_pdf(simulation_id: int, db_service) -> BytesIO:
    """Generate PDF from simulation_id"""
    print(f"Generating PDF for simulation {simulation_id}")
    
    simulation_data = db_service.get_simulation_by_id(simulation_id)
    
    if not simulation_data:
        raise ValueError(f"Simulation {simulation_id} not found")
    
    generator = EnhancedPDFReportGenerator(simulation_data)
    pdf_buffer = generator.generate_pdf()
    
    print(f"✅ PDF generated: {len(pdf_buffer.getvalue())} bytes")
    
    return pdf_buffer


def build_report_pdf(simulation_id: int, db_service) -> BytesIO:
    """Backward-compatible wrapper"""
    return generate_report_pdf(simulation_id, db_service)


if __name__ == "__main__":
    try:
        from backend.services.database import DatabaseService
    except:
        from services.database import DatabaseService
    
    db = DatabaseService()
    simulation_id = 1
    
    try:
        pdf_buffer = generate_report_pdf(simulation_id, db)
        
        with open(f"simulation_{simulation_id}_report.pdf", "wb") as f:
            f.write(pdf_buffer.getvalue())
        
        print(f"✅ PDF saved: simulation_{simulation_id}_report.pdf")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()