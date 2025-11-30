-- UrbanFlow Database Schema
-- Database for traffic simulation system with geospatial support

-- Enable PostGIS extension for geospatial operations
CREATE EXTENSION IF NOT EXISTS postgis;

-- =============================================================================
-- TABLE: users
-- Stores information about registered users (urban planners, traffic managers)
-- =============================================================================
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'planner', -- 'admin', 'planner', 'viewer'
    organization VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Index for faster login queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- =============================================================================
-- TABLE: password_reset_tokens
-- Stores password reset tokens used in the forgot/reset password flow
-- =============================================================================
CREATE TABLE password_reset_tokens (
    id SERIAL PRIMARY KEY,
    token VARCHAR(255) NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP
);

CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);


-- =============================================================================
-- TABLE: segments
-- Contains geospatial and structural information about road segments
-- =============================================================================
CREATE TABLE segments (
    segment_id SERIAL PRIMARY KEY,
    segment_name VARCHAR(255),
    geometry GEOMETRY(LINESTRING, 4326) NOT NULL, -- WGS84 coordinate system
    length_meters DECIMAL(10, 2), -- Length in meters
    num_lanes INTEGER,
    road_type VARCHAR(50), -- 'arterial', 'collector', 'local'
    free_flow_speed DECIMAL(5, 2), -- Speed in km/h
    capacity INTEGER, -- Maximum vehicles per hour
    location_description TEXT,
    from_node VARCHAR(100),
    to_node VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Spatial index for geometry queries
CREATE INDEX idx_segments_geometry ON segments USING GIST(geometry);
CREATE INDEX idx_segments_road_type ON segments(road_type);

-- =============================================================================
-- TABLE: simulation_runs
-- Records each simulation instance with disruption parameters
-- =============================================================================
CREATE TABLE simulation_runs (
    simulation_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    simulation_name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Disruption parameters
    disruption_type VARCHAR(100) NOT NULL, -- 'roadwork', 'event', 'accident', 'flood'
    disruption_location VARCHAR(255) NOT NULL,
    disruption_geometry GEOMETRY(POLYGON, 4326), -- Area affected by disruption
    
    -- Time parameters
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    time_segment VARCHAR(50), -- 'morning', 'afternoon', 'night', 'all_day'
    
    -- Additional parameters
    severity_level VARCHAR(50), -- 'low', 'moderate', 'high', 'critical'
    alternate_route_provided BOOLEAN DEFAULT FALSE,
    alternate_route_geometry GEOMETRY(LINESTRING, 4326),
    
    -- Metadata
    simulation_status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'completed', 'published'
    run_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Simulation results summary
    total_affected_segments INTEGER,
    average_delay_ratio DECIMAL(5, 2),
    max_delay_ratio DECIMAL(5, 2)
);

-- Indexes for common queries
CREATE INDEX idx_simulation_runs_user_id ON simulation_runs(user_id);
CREATE INDEX idx_simulation_runs_status ON simulation_runs(simulation_status);
CREATE INDEX idx_simulation_runs_timestamp ON simulation_runs(run_timestamp);
CREATE INDEX idx_simulation_runs_disruption_geometry ON simulation_runs USING GIST(disruption_geometry);

-- =============================================================================
-- TABLE: run_results
-- Stores detailed results for each road segment affected by a simulation
-- =============================================================================
CREATE TABLE run_results (
    result_id SERIAL PRIMARY KEY,
    simulation_id INTEGER NOT NULL REFERENCES simulation_runs(simulation_id) ON DELETE CASCADE,
    segment_id INTEGER NOT NULL REFERENCES segments(segment_id) ON DELETE CASCADE,
    
    -- Predicted traffic metrics
    delay_ratio DECIMAL(5, 2) NOT NULL, -- Ratio of delay (e.g., 1.5 = 50% increase in travel time)
    predicted_speed DECIMAL(5, 2), -- Predicted speed in km/h
    congestion_level VARCHAR(50), -- 'free_flow', 'light', 'moderate', 'heavy', 'standstill'
    estimated_delay_minutes DECIMAL(10, 2), -- Estimated delay in minutes
    
    -- Time-segmented predictions
    morning_delay_ratio DECIMAL(5, 2),
    afternoon_delay_ratio DECIMAL(5, 2),
    night_delay_ratio DECIMAL(5, 2),
    
    -- Confidence metrics
    prediction_confidence DECIMAL(5, 2), -- 0-100 confidence score
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Composite unique constraint
    UNIQUE(simulation_id, segment_id)
);

-- Indexes for performance
CREATE INDEX idx_run_results_simulation_id ON run_results(simulation_id);
CREATE INDEX idx_run_results_segment_id ON run_results(segment_id);
CREATE INDEX idx_run_results_congestion_level ON run_results(congestion_level);
CREATE INDEX idx_run_results_delay_ratio ON run_results(delay_ratio DESC);

-- =============================================================================
-- TABLE: published_runs
-- Tracks which simulations have been published to the public map
-- =============================================================================
CREATE TABLE published_runs (
    published_id SERIAL PRIMARY KEY,
    simulation_id INTEGER UNIQUE NOT NULL REFERENCES simulation_runs(simulation_id) ON DELETE CASCADE,
    published_by INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    
    -- Publication details
    slug VARCHAR(255) UNIQUE NOT NULL, -- URL-friendly identifier
    title VARCHAR(255) NOT NULL,
    public_description TEXT,
    
    -- Publication metadata
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- Optional expiration date
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Verification
    verification_code VARCHAR(100),
    verified_at TIMESTAMP,
    
    -- Analytics
    view_count INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_published_runs_simulation_id ON published_runs(simulation_id);
CREATE INDEX idx_published_runs_slug ON published_runs(slug);
CREATE INDEX idx_published_runs_is_active ON published_runs(is_active);
CREATE INDEX idx_published_runs_published_at ON published_runs(published_at DESC);

-- =============================================================================
-- TABLE: mitigation_recommendations
-- Stores AI-generated mitigation strategies for each simulation
-- =============================================================================
CREATE TABLE mitigation_recommendations (
    recommendation_id SERIAL PRIMARY KEY,
    simulation_id INTEGER NOT NULL REFERENCES simulation_runs(simulation_id) ON DELETE CASCADE,
    
    recommendation_type VARCHAR(100), -- 'scheduling', 'signal_timing', 'alternate_route', 'lane_management'
    recommendation_text TEXT NOT NULL,
    priority_level VARCHAR(50), -- 'high', 'medium', 'low'
    estimated_impact VARCHAR(255), -- Description of expected impact
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mitigation_recommendations_simulation_id ON mitigation_recommendations(simulation_id);

-- =============================================================================
-- TABLE: travel_time_advice
-- Stores travel time recommendations for the public
-- =============================================================================
CREATE TABLE travel_time_advice (
    advice_id SERIAL PRIMARY KEY,
    simulation_id INTEGER NOT NULL REFERENCES simulation_runs(simulation_id) ON DELETE CASCADE,
    
    time_period VARCHAR(50), -- 'early_morning', 'morning', 'midday', 'afternoon', 'evening', 'night'
    recommended BOOLEAN DEFAULT FALSE, -- Is this a recommended time to travel?
    expected_delay_minutes DECIMAL(10, 2),
    congestion_severity VARCHAR(50),
    advice_text TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_travel_time_advice_simulation_id ON travel_time_advice(simulation_id);

-- =============================================================================
-- TABLE: audit_log
-- Tracks all important system actions for security and accountability
-- =============================================================================
CREATE TABLE audit_log (
    log_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    action_type VARCHAR(100) NOT NULL, -- 'create_simulation', 'publish_simulation', 'delete_simulation', 'login', 'logout'
    entity_type VARCHAR(50), -- 'simulation', 'user', 'segment'
    entity_id INTEGER,
    details JSONB, -- Additional details in JSON format
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_action_type ON audit_log(action_type);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- View: Published simulations with summary information
CREATE VIEW v_published_simulations AS
SELECT 
    pr.published_id,
    pr.slug,
    pr.title,
    pr.public_description,
    pr.published_at,
    pr.is_active,
    pr.view_count,
    sr.simulation_name,
    sr.disruption_type,
    sr.disruption_location,
    sr.start_time,
    sr.end_time,
    sr.severity_level,
    sr.total_affected_segments,
    sr.average_delay_ratio,
    sr.disruption_geometry,
    u.username as published_by_username,
    u.organization
FROM published_runs pr
JOIN simulation_runs sr ON pr.simulation_id = sr.simulation_id
JOIN users u ON pr.published_by = u.user_id
WHERE pr.is_active = TRUE;

-- View: Simulation results with segment details
CREATE VIEW v_simulation_results_detailed AS
SELECT 
    rr.result_id,
    rr.simulation_id,
    sr.simulation_name,
    sr.disruption_type,
    s.segment_id,
    s.segment_name,
    s.geometry,
    s.road_type,
    rr.delay_ratio,
    rr.congestion_level,
    rr.estimated_delay_minutes,
    rr.morning_delay_ratio,
    rr.afternoon_delay_ratio,
    rr.night_delay_ratio,
    rr.prediction_confidence
FROM run_results rr
JOIN simulation_runs sr ON rr.simulation_id = sr.simulation_id
JOIN segments s ON rr.segment_id = s.segment_id;

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to update timestamp on record modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_segments_updated_at BEFORE UPDATE ON segments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_simulation_runs_updated_at BEFORE UPDATE ON simulation_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_published_runs_updated_at BEFORE UPDATE ON published_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate unique slug for published runs
CREATE OR REPLACE FUNCTION generate_slug(text_input TEXT)
RETURNS TEXT AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 1;
BEGIN
    -- Convert to lowercase, replace spaces with hyphens, remove special chars
    base_slug := regexp_replace(
        lower(trim(text_input)), 
        '[^a-z0-9\s-]', 
        '', 
        'g'
    );
    base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
    base_slug := regexp_replace(base_slug, '-+', '-', 'g');
    
    final_slug := base_slug;
    
    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM published_runs WHERE slug = final_slug) LOOP
        final_slug := base_slug || '-' || counter;
        counter := counter + 1;
    END LOOP;
    
    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SAMPLE DATA (for testing)
-- =============================================================================

-- Insert sample user
INSERT INTO users (username, email, password_hash, full_name, role, organization)
VALUES 
    ('admin', 'admin@urbanflow.com', '$2b$12$example_hash', 'System Administrator', 'admin', 'UrbanFlow'),
    ('planner1', 'planner@calamba.gov.ph', '$2b$12$example_hash', 'Juan Dela Cruz', 'planner', 'Calamba City Planning Office');

-- Insert sample segments (example road segments in Calamba)
INSERT INTO segments (segment_name, geometry, length_meters, num_lanes, road_type, free_flow_speed, capacity)
VALUES 
    ('Maharlika Highway - North', ST_GeomFromText('LINESTRING(121.1653 14.2117, 121.1670 14.2145)', 4326), 350, 4, 'arterial', 60, 2400),
    ('Real Street', ST_GeomFromText('LINESTRING(121.1640 14.2100, 121.1660 14.2120)', 4326), 250, 2, 'collector', 40, 1200),
    ('J.P. Rizal Avenue', ST_GeomFromText('LINESTRING(121.1645 14.2095, 121.1665 14.2110)', 4326), 280, 3, 'arterial', 50, 1800);

-- Comments
COMMENT ON TABLE users IS 'Stores registered users including urban planners and traffic managers';
COMMENT ON TABLE segments IS 'Contains geospatial information about road segments in Calamba City';
COMMENT ON TABLE simulation_runs IS 'Records simulation instances with disruption parameters';
COMMENT ON TABLE run_results IS 'Stores predicted traffic impacts for each segment in a simulation';
COMMENT ON TABLE published_runs IS 'Tracks simulations published to the public map with verification';
COMMENT ON TABLE mitigation_recommendations IS 'AI-generated strategies to mitigate traffic disruptions';
COMMENT ON TABLE travel_time_advice IS 'Travel time recommendations for the public';
COMMENT ON TABLE audit_log IS 'Security and accountability log of all system actions';


-- =============================================================================
-- VERIFICATION ON SIMULATION RUNS
-- =============================================================================

-- Add OTP table for verification
CREATE TABLE verification_otps (
    otp_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    simulation_id INTEGER NOT NULL REFERENCES simulation_runs(simulation_id) ON DELETE CASCADE,
    otp_code VARCHAR(6) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP
);

CREATE INDEX idx_verification_otps_user_id ON verification_otps(user_id);
CREATE INDEX idx_verification_otps_simulation_id ON verification_otps(simulation_id);
CREATE INDEX idx_verification_otps_otp_code ON verification_otps(otp_code);

-- Add published_by name to published_runs view
DROP VIEW IF EXISTS v_published_simulations;
CREATE VIEW v_published_simulations AS
SELECT 
    pr.published_id,
    pr.slug,
    pr.title,
    pr.public_description,
    pr.published_at,
    pr.is_active,
    pr.view_count,
    sr.simulation_name,
    sr.disruption_type,
    sr.disruption_location,
    sr.start_time,
    sr.end_time,
    sr.severity_level,
    sr.total_affected_segments,
    sr.average_delay_ratio,
    sr.disruption_geometry,
    sr.updated_at as last_modified,
    u.username as published_by_username,
    u.full_name as published_by_name,
    u.organization,
    publisher.email as publisher_email
FROM published_runs pr
JOIN simulation_runs sr ON pr.simulation_id = sr.simulation_id
JOIN users u ON sr.user_id = u.user_id
JOIN users publisher ON pr.published_by = publisher.user_id
WHERE pr.is_active = TRUE;