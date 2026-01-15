// DOM Elements
const fileInput = document.getElementById('fileInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const errorContainer = document.getElementById('errorContainer');
const errorMessage = document.getElementById('errorMessage');
const dashboard = document.getElementById('dashboard');

const datasetShape = document.getElementById('datasetShape');
const columnsCount = document.getElementById('columnsCount');
const missingValues = document.getElementById('missingValues');
const dataTypes = document.getElementById('dataTypes');
const aiInsights = document.getElementById('aiInsights');

// Charts instances
let missingChart = null;
let correlationChart = null;

// State
let selectedFile = null;
let isAnalyzing = false;

// Event Listeners
fileInput.addEventListener('change', handleFileChange);
analyzeBtn.addEventListener('click', handleAnalyzeClick);
document.addEventListener('keydown', handleKeyDown);

// File validation
function validateFile(file) {
    if (!file) return { valid: false, error: 'No file selected' };
    
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (fileExtension !== 'csv') {
        return { valid: false, error: 'Only CSV files are supported' };
    }
    
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
        return { valid: false, error: 'File size exceeds 50MB limit' };
    }
    
    return { valid: true, error: null };
}

// File change handler
function handleFileChange(e) {
    const file = e.target.files[0];
    const validation = validateFile(file);
    
    if (!validation.valid) {
        showError(validation.error);
        fileInput.value = '';
        selectedFile = null;
        analyzeBtn.disabled = true;
        return;
    }
    
    selectedFile = file;
    analyzeBtn.disabled = false;
    hideError();
    
    // Optional: Preview file info
    updateFilePreview(file);
}

// File preview update
function updateFilePreview(file) {
    const fileSize = formatFileSize(file.size);
    console.log(`Selected file: ${file.name} (${fileSize})`);
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Analyze button click handler
async function handleAnalyzeClick() {
    if (isAnalyzing || !selectedFile) return;
    
    const validation = validateFile(selectedFile);
    if (!validation.valid) {
        showError(validation.error);
        return;
    }
    
    // Start analysis
    isAnalyzing = true;
    setAnalyzeButtonState(true);
    hideError();
    
    try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        // Simulate API delay for better UX feedback
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const response = await fetch('/analyze', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Validate response structure
        if (!data.shape || !data.columns || !data.eda || !data.ai_insights) {
            throw new Error('Invalid response format from server');
        }
        
        updateDashboard(data);
        dashboard.classList.remove('hidden');
        
        // Smooth scroll to dashboard
        dashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
    } catch (err) {
        console.error('Analysis error:', err);
        showError(err.message || 'Failed to analyze file. Please try again.');
    } finally {
        isAnalyzing = false;
        setAnalyzeButtonState(false);
    }
}

// Set analyze button state
function setAnalyzeButtonState(analyzing) {
    analyzeBtn.disabled = analyzing;
    
    if (analyzing) {
        analyzeBtn.innerHTML = `
            <span class="btn-text">Analyzing...</span>
            <div class="loading-spinner">
                <div class="spinner-dot"></div>
                <div class="spinner-dot"></div>
                <div class="spinner-dot"></div>
            </div>
        `;
    } else {
        analyzeBtn.innerHTML = '<span class="btn-text">Analyze with AI</span>';
    }
}

// Update dashboard with data
function updateDashboard(data) {
    // Update basic stats
    datasetShape.textContent = `${data.shape[0].toLocaleString()} × ${data.shape[1]}`;
    columnsCount.textContent = data.columns.length;
    
    // Calculate and update missing values
    const totalMissing = Object.values(data.eda.missing_values || {})
        .reduce((a, b) => a + b, 0);
    missingValues.textContent = totalMissing.toLocaleString();
    
    // Update data types
    const typesCount = {};
    Object.values(data.data_types || {}).forEach(t => {
        const type = String(t).toLowerCase();
        typesCount[type] = (typesCount[type] || 0) + 1;
    });
    
    const typeStrings = Object.entries(typesCount)
        .map(([k, v]) => `${v} ${k}`)
        .join(', ');
    dataTypes.textContent = typeStrings || 'No data types available';
    
    // Update AI insights with markdown support
    updateAIInsights(data.ai_insights);
    
    // Create visualizations
    if (data.eda.missing_values) {
        drawMissingChart(data.eda.missing_values, data.columns);
    }
    
    if (data.eda.correlation_matrix && data.columns) {
        drawCorrelationChart(data.eda.correlation_matrix, data.columns);
    }
    
    // Update last updated time
    updateTimestamp();
}

// Update AI insights with markdown-like formatting
function updateAIInsights(insights) {
    if (!insights) {
        aiInsights.innerHTML = '<p class="no-insights">No insights generated</p>';
        return;
    }
    
    // Simple markdown-like formatting
    const formatted = insights
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^# (.*$)/gm, '<h2>$1</h2>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/^- (.*$)/gm, '<li>$1</li>')
        .replace(/^(\d+)\. (.*$)/gm, '<li>$2</li>');
    
    // Wrap lists properly
    let html = '<p>' + formatted + '</p>';
    html = html.replace(/<li>(.*?)<\/li>/g, '<ul><li>$1</li></ul>');
    html = html.replace(/<\/ul>\s*<ul>/g, '');
    
    aiInsights.innerHTML = html;
}

// Draw missing values chart
function drawMissingChart(missingData, columns) {
    const ctx = document.getElementById('missingValuesChart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (missingChart) {
        missingChart.destroy();
    }
    
    const labels = columns || Object.keys(missingData);
    const values = labels.map(col => missingData[col] || 0);
    
    // Create gradient for bars
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(108, 99, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(108, 99, 255, 0.2)');
    
    missingChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Missing Values',
                data: values,
                backgroundColor: gradient,
                borderColor: '#6C63FF',
                borderWidth: 1,
                borderRadius: 6,
                hoverBackgroundColor: '#8b5cf6'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `Missing: ${context.parsed.y}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#94a3b8',
                        maxRotation: 45,
                        minRotation: 0
                    }
                }
            }
        }
    });
}

// Draw correlation matrix chart
function drawCorrelationChart(correlationMatrix, columns) {
    const ctx = document.getElementById('correlationChart');
    if (!ctx || !correlationMatrix || !columns) return;
    
    // Destroy existing chart
    if (correlationChart) {
        correlationChart.destroy();
    }
    
    // Prepare data for matrix chart
    const data = {
        labels: columns,
        datasets: [{
            label: 'Correlation Matrix',
            data: correlationMatrix.flatMap((row, i) => 
                row.map((value, j) => ({x: j, y: i, v: value}))
            ),
            backgroundColor: (context) => {
                const value = context.dataset.data[context.dataIndex].v;
                const absValue = Math.abs(value);
                
                // Blue for negative, purple for positive
                if (value < 0) {
                    return `rgba(59, 130, 246, ${absValue})`;
                } else {
                    return `rgba(139, 92, 246, ${absValue})`;
                }
            },
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            width: ({chart}) => (chart.chartArea || {}).width / columns.length - 1,
            height: ({chart}) => (chart.chartArea || {}).height / columns.length - 1
        }]
    };
    
    correlationChart = new Chart(ctx, {
        type: 'matrix',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        title: (context) => {
                            const xIndex = context[0].dataIndex;
                            const yIndex = context[0].dataset.data[context[0].dataIndex].y;
                            return `${columns[yIndex]} vs ${columns[xIndex]}`;
                        },
                        label: (context) => {
                            const value = context.dataset.data[context.dataIndex].v;
                            return `Correlation: ${value.toFixed(3)}`;
                        }
                    }
                }
            }
        }
    });
}

// Update timestamp
function updateTimestamp() {
    const now = new Date();
    const timeElement = document.getElementById('updateTime');
    if (timeElement) {
        timeElement.textContent = now.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
    }
}

// Show error message
function showError(message) {
    errorMessage.textContent = message;
    errorContainer.classList.remove('hidden');
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        if (!errorContainer.classList.contains('hidden')) {
            hideError();
        }
    }, 10000);
}

// Hide error message
function hideError() {
    errorContainer.classList.add('hidden');
}

// Keyboard shortcuts
function handleKeyDown(e) {
    // Ctrl + Enter to analyze
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (!analyzeBtn.disabled) {
            handleAnalyzeClick();
        }
    }
    
    // Escape to hide error
    if (e.key === 'Escape') {
        hideError();
    }
}

// Initialize dashboard if returning with data
function init() {
    // Check if we should show dashboard (for demo purposes)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('demo')) {
        // Load demo data
        loadDemoData();
    }
}

// Load demo data for presentation
function loadDemoData() {
    const demoData = {
        shape: [1500, 10],
        columns: ['id', 'age', 'salary', 'department', 'experience_years', 
                 'job_level', 'performance_score', 'satisfaction_level', 
                 'attrition', 'training_hours'],
        eda: {
            missing_values: {
                age: 5,
                salary: 2,
                department: 0,
                experience_years: 12,
                job_level: 1,
                performance_score: 0,
                satisfaction_level: 3,
                attrition: 0,
                training_hours: 8
            },
            correlation_matrix: Array(10).fill().map(() => 
                Array(10).fill().map(() => (Math.random() * 2 - 1).toFixed(3))
            )
        },
        data_types: {
            id: 'integer',
            age: 'integer',
            salary: 'float',
            department: 'categorical',
            experience_years: 'integer',
            job_level: 'integer',
            performance_score: 'float',
            satisfaction_level: 'float',
            attrition: 'boolean',
            training_hours: 'integer'
        },
        ai_insights: `## Dataset Analysis Results

**Dataset Overview:** Your dataset contains 1,500 employee records with 10 features. The data appears to be well-structured with minimal missing values.

**Key Findings:**
- Strong correlation between salary and job_level (0.87)
- Experience_years shows moderate correlation with performance_score (0.62)
- Satisfaction_level negatively correlates with attrition (-0.71)

**Recommendations:**
1. Impute missing values using median for numerical columns
2. Apply one-hot encoding to department column
3. Normalize salary and training_hours features
4. Consider feature engineering for salary/experience ratio

**Next Steps:** This dataset is suitable for predictive modeling of employee attrition.`
    };
    
    updateDashboard(demoData);
    dashboard.classList.remove('hidden');
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);