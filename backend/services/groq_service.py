import os
import requests
from typing import Dict, List, Optional
import json

class GroqService:
    """
    Service for generating AI-powered mitigation recommendations using Groq
    Uses llama-3.3-70b-versatile for intelligent traffic analysis
    """
    
    def __init__(self):
        self.api_key = os.getenv('GROQ_API_KEY')
        self.base_url = "https://api.groq.com/openai/v1/chat/completions"
        self.model = "llama-3.3-70b-versatile"
        
        if not self.api_key:
            print("⚠️ GROQ_API_KEY not found in environment variables")
    
    def generate_mitigation_recommendations(
        self,
        simulation_data: Dict,
        results_summary: Dict
    ) -> List[Dict]:
        """
        Generate intelligent mitigation recommendations based on simulation results
        """
        
        if not self.api_key:
            print("⚠️ No API key, using fallback recommendations")
            return self._fallback_recommendations(simulation_data, results_summary)
        
        # Build context prompt for Groq
        prompt = self._build_prompt(simulation_data, results_summary)
        
        try:
            print(f"🤖 Calling Groq API with model: {self.model}")
            
            response = requests.post(
                self.base_url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": self.model,
                    "messages": [
                        {
                            "role": "system",
                            "content": """You are an expert traffic management consultant for Calamba City, Philippines. 
                            Analyze traffic simulations and provide actionable mitigation strategies.
                            
                            CRITICAL: You MUST respond with valid JSON in this EXACT format:
                            {
                              "recommendations": [
                                {
                                  "type": "scheduling",
                                  "text": "Clear, actionable recommendation in 2-3 sentences",
                                  "priority": "high",
                                  "impact": "Expected outcome in 1-2 sentences",
                                  "cost": "low",
                                  "timeline": "immediate"
                                }
                              ]
                            }
                            
                            Types: scheduling, traffic_management, communication, infrastructure, alternative_routes
                            Priority: high, medium, low
                            Cost: low, medium, high
                            Timeline: immediate, short-term, long-term
                            
                            Provide 4-6 recommendations. Focus on practical solutions for Philippine LGU context."""
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "temperature": 0.7,
                    "max_tokens": 2000,
                    "top_p": 1,
                    "stream": False
                },
                timeout=30
            )
            
            print(f"📡 Groq response status: {response.status_code}")
            
            if response.status_code != 200:
                print(f"❌ Groq API error: {response.text}")
                return self._fallback_recommendations(simulation_data, results_summary)
            
            result = response.json()
            
            # Extract content
            content = result.get('choices', [{}])[0].get('message', {}).get('content', '')
            
            if not content:
                print("❌ Empty response from Groq")
                return self._fallback_recommendations(simulation_data, results_summary)
            
            print(f"📄 Groq response content preview: {content[:200]}...")
            
            # Parse JSON response
            try:
                recommendations_data = json.loads(content)
                
                # Handle if wrapped in "recommendations" key
                if isinstance(recommendations_data, dict) and 'recommendations' in recommendations_data:
                    recommendations_list = recommendations_data['recommendations']
                elif isinstance(recommendations_data, list):
                    recommendations_list = recommendations_data
                else:
                    print(f"❌ Unexpected response structure: {type(recommendations_data)}")
                    return self._fallback_recommendations(simulation_data, results_summary)
                
                # Validate structure
                if not isinstance(recommendations_list, list) or len(recommendations_list) == 0:
                    print("❌ Invalid recommendations format")
                    return self._fallback_recommendations(simulation_data, results_summary)
                
                # Ensure all required fields exist
                validated_recs = []
                for rec in recommendations_list:
                    if isinstance(rec, dict) and 'text' in rec:
                        validated_recs.append({
                            'type': rec.get('type', 'general'),
                            'text': rec.get('text', 'No description provided'),
                            'priority': rec.get('priority', 'medium'),
                            'impact': rec.get('impact', 'Expected to reduce congestion'),
                            'cost': rec.get('cost', 'medium'),
                            'timeline': rec.get('timeline', 'short-term')
                        })
                
                if validated_recs:
                    print(f"✅ Generated {len(validated_recs)} AI recommendations")
                    return validated_recs
                else:
                    print("❌ No valid recommendations after validation")
                    return self._fallback_recommendations(simulation_data, results_summary)
                
            except json.JSONDecodeError as e:
                print(f"❌ JSON parsing error: {e}")
                print(f"Raw content: {content}")
                return self._fallback_recommendations(simulation_data, results_summary)
        
        except requests.exceptions.Timeout:
            print("❌ Groq API timeout")
            return self._fallback_recommendations(simulation_data, results_summary)
        except requests.exceptions.RequestException as e:
            print(f"❌ Groq API request error: {e}")
            return self._fallback_recommendations(simulation_data, results_summary)
        except Exception as e:
            print(f"❌ Unexpected error in Groq service: {e}")
            import traceback
            traceback.print_exc()
            return self._fallback_recommendations(simulation_data, results_summary)
    
    def _build_prompt(self, simulation_data: Dict, results_summary: Dict) -> str:
        """Build detailed context prompt for Groq"""
        
        disruption_type = simulation_data.get('disruption_type', 'roadwork')
        location = simulation_data.get('disruption_location', 'Unknown')
        area = simulation_data.get('area', 'Unknown')
        road = simulation_data.get('road_corridor', 'Unknown')
        # ✅ FIX: Better datetime handling
        start_date = simulation_data.get('start_datetime', 'Not specified')
        end_date = simulation_data.get('end_datetime', 'Not specified')

            # Convert to readable format if datetime objects
        if hasattr(start_date, 'strftime'):
            start_date = start_date.strftime('%Y-%m-%d %H:%M')
        if hasattr(end_date, 'strftime'):
            end_date = end_date.strftime('%Y-%m-%d %H:%M')
        
        description = simulation_data.get('description', '')
        avg_severity = results_summary.get('avg_severity', 1.0)
        heavy_pct = results_summary.get('heavy_percentage', 0)
        total_hours = results_summary.get('total_hours', 0)
        avg_delay = results_summary.get('avg_delay_minutes', 0)
        
        # Determine severity description
        if avg_severity >= 2.0:
            severity_desc = "SEVERE - Heavy congestion expected"
        elif avg_severity >= 1.5:
            severity_desc = "HIGH - Significant delays expected"
        elif avg_severity >= 1.0:
            severity_desc = "MODERATE - Some congestion expected"
        else:
            severity_desc = "LOW - Minimal impact expected"
        
        prompt = f"""Analyze this traffic disruption simulation for Calamba City and provide mitigation recommendations:

**DISRUPTION DETAILS:**
- Type: {disruption_type}
- Location: {area} - {road}
- Full Location: {location}
- Duration: {start_date} to {end_date}
- Total Hours: {total_hours}
- Description: {description or 'Not provided'}

**PREDICTED IMPACT:**
- Severity Level: {severity_desc}
- Average Severity Score: {avg_severity:.2f}/3.0
- Heavy Congestion Hours: {heavy_pct}% of total duration
- Average Expected Delay: {avg_delay:.1f} minutes

**CONTEXT:**
- Calamba City is in Laguna, Philippines (CALABARZON region)
- Major routes: Maharlika Highway, Calamba-Pagsanjan Road
- Peak hours: 7-9 AM (morning rush), 5-7 PM (evening rush)
- Many schools, commercial areas, and industrial zones
- Typical LGU coordination involves DPWH, CCPOSO, City Engineering

**YOUR TASK:**
Provide 4-6 specific, actionable recommendations to mitigate this disruption.
Consider:
1. Optimal scheduling/timing
2. Traffic management strategies
3. Public communication methods
4. Alternative routes
5. Infrastructure adjustments
6. Enforcement measures

Return valid JSON following the exact structure in your system prompt."""
        
        return prompt
    
    def _fallback_recommendations(self, simulation_data: Dict, results_summary: Dict) -> List[Dict]:
        """Rule-based fallback recommendations"""
        
        disruption_type = simulation_data.get('disruption_type', 'roadwork')
        avg_severity = results_summary.get('avg_severity', 1.0)
        heavy_pct = results_summary.get('heavy_percentage', 0)
        total_hours = results_summary.get('total_hours', 0)
        
        recommendations = []
        
        # High severity recommendations
        if avg_severity >= 1.5 or heavy_pct > 40:
            recommendations.append({
                'type': 'scheduling',
                'text': 'Reschedule work to off-peak hours (9 PM - 5 AM) or weekends to minimize impact on daily commuters and reduce congestion during peak traffic periods.',
                'priority': 'high',
                'impact': 'Can reduce peak-hour congestion by 40-60%, significantly improving traffic flow for morning and evening commuters.',
                'cost': 'medium',
                'timeline': 'immediate'
            })
            
            recommendations.append({
                'type': 'traffic_management',
                'text': 'Deploy traffic enforcers at critical junctions during peak hours (7-9 AM, 5-7 PM) to manually manage flow and prevent gridlock.',
                'priority': 'high',
                'impact': 'Prevents gridlock at major intersections, maintains flow through work zones, reduces backup by 30-40%.',
                'cost': 'low',
                'timeline': 'immediate'
            })
        
        # Communication - always important
        recommendations.append({
            'type': 'communication',
            'text': 'Post advance notices on CCPOSO Facebook, local radio, and digital signage 1-2 weeks before start date. Include expected delays, affected routes, and alternative paths.',
            'priority': 'high' if avg_severity >= 1.5 else 'medium',
            'impact': 'Allows commuters to plan ahead, adjust schedules, choose alternate routes, reducing surprise congestion and frustration.',
            'cost': 'low',
            'timeline': 'immediate'
        })
        
        # Type-specific recommendations
        if disruption_type == 'roadwork':
            recommendations.append({
                'type': 'infrastructure',
                'text': 'Install temporary traffic signals, clear directional signage, and reflective barriers to guide motorists safely through work zones.',
                'priority': 'medium',
                'impact': 'Reduces confusion, improves safety, and maintains organized flow through disrupted areas.',
                'cost': 'low',
                'timeline': 'short-term'
            })
            
            if total_hours > 48:  # Multi-day work
                recommendations.append({
                    'type': 'scheduling',
                    'text': 'Implement phased construction with partial lane closures instead of full road closure. Work on alternating sections to maintain one-way flow.',
                    'priority': 'high',
                    'impact': 'Maintains partial accessibility, reduces total impact duration, allows emergency vehicle access.',
                    'cost': 'medium',
                    'timeline': 'immediate'
                })
        
        elif disruption_type == 'event':
            recommendations.append({
                'type': 'alternative_routes',
                'text': 'Designate and clearly mark official detour routes with temporary signage and traffic marshals at key decision points 24 hours before event.',
                'priority': 'high',
                'impact': 'Distributes traffic load across multiple routes, prevents bottlenecks, reduces delays by 30-50%.',
                'cost': 'low',
                'timeline': 'immediate'
            })
            
            recommendations.append({
                'type': 'traffic_management',
                'text': 'Coordinate with CCPOSO for temporary parking restrictions and towing enforcement along event route 48 hours prior.',
                'priority': 'medium',
                'impact': 'Ensures clear lanes for through traffic, prevents illegal parking-induced congestion.',
                'cost': 'low',
                'timeline': 'short-term'
            })
        
        # Moderate severity recommendation
        if 1.0 <= avg_severity < 1.5:
            recommendations.append({
                'type': 'traffic_management',
                'text': 'Coordinate with CCPOSO to adjust traffic signal timing along affected corridors, extending green phases for through traffic.',
                'priority': 'medium',
                'impact': 'Optimizes flow through adjacent intersections, reduces queue lengths, improves overall corridor performance.',
                'cost': 'low',
                'timeline': 'short-term'
            })
        
        # Always add public transport recommendation
        if avg_severity >= 1.2:
            recommendations.append({
                'type': 'communication',
                'text': 'Encourage use of public transport and carpooling through social media campaigns. Coordinate with jeepney/bus operators for additional trips during peak hours.',
                'priority': 'medium',
                'impact': 'Reduces private vehicle volume by 10-15%, decreases parking demand, improves overall traffic flow.',
                'cost': 'low',
                'timeline': 'short-term'
            })
        
        print(f"✅ Generated {len(recommendations)} fallback recommendations")
        return recommendations[:6]  # Return max 6