
# UrbanFlow Ultimate Model - Training Summary

## Training Date
2026-01-05 07:41:57

## Dataset
- Total Records: 26,103
- Training Set: 43,311 (165.9%)
- Test Set: 5,221 (20.0%)
- Features: 63
- SMOTE Applied: Yes

## Model Configuration (OPTIMIZED)
- Algorithm: Random Forest Classifier
- Trees: 400
- Max Depth: 35
- Min Samples Split: 5
- Min Samples Leaf: 2
- Max Features: sqrt
- Class Weight: Balanced
- Bootstrap: True

## Performance Metrics

### Primary Metrics
- Overall Accuracy: 90.00%
- Mean Absolute Error: 0.1117
- Cohen's Kappa: 0.7817 (Good)
- Balanced Accuracy: 84.96%
- Weighted F1-Score: 0.8996

### Validation Metrics
- Out-of-Bag Score: 94.58% (if applicable)
- Cross-Validation (5-fold): 89.22% (±0.26%)

### Per-Class Performance
- Light Traffic:    Precision: 0.935, Recall: 0.944, F1: 0.940
- Moderate Traffic: Precision: 0.820, Recall: 0.799, F1: 0.810
- Heavy Traffic:    Precision: 0.818, Recall: 0.805, F1: 0.812

## Optimization Methods Applied
1. Stratified 5-Fold Cross-Validation
2. SMOTE for Class Balancing
3. Grid Search Hyperparameter Tuning
4. Feature Importance Analysis

## Top 5 Important Features
22. data_completeness_score: 0.1020
3. hour_cos: 0.0614
2. hour_sin: 0.0612
19. has_real_status: 0.0565
11. is_peak_rush: 0.0519

## References
- Breiman, L. (2001). Random Forests. Machine Learning, 45(1), 5-32.
- Sun, S., Yan, H., & Lang, Z. (2024). Traffic congestion prediction with Random Forest.
- Highway Capacity Manual (HCM 2010)
- Chawla et al. (2002). SMOTE: Synthetic Minority Over-sampling Technique
