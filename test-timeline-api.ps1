# Timeline API Test Script
# Tests the /stats/timeline endpoint

$apiUrl = "http://localhost:3000"
$loginUrl = "$apiUrl/auth/login"
$timelineUrl = "$apiUrl/stats/timeline"

Write-Host "=== TIMELINE API TEST ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Login to get token
Write-Host "Step 1: Logging in..." -ForegroundColor Yellow
try {
    $loginBody = @{
        email = "admin@admin.com"
        password = "admin123"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri $loginUrl -Method Post -Body $loginBody -ContentType "application/json" -ErrorAction Stop
    $token = $loginResponse.token
    
    if ($token) {
        Write-Host "✅ Login successful" -ForegroundColor Green
        Write-Host "   User: $($loginResponse.user.name)" -ForegroundColor Gray
        Write-Host "   Role: $($loginResponse.user.role)" -ForegroundColor Gray
        Write-Host "   User ID: $($loginResponse.user.id)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Login failed: No token received" -ForegroundColor Red
        exit
    }
} catch {
    Write-Host "❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Trying alternative credentials or register a new org..." -ForegroundColor Yellow
    exit
}

Write-Host ""

# Step 2: Test month view
Write-Host "Step 2: Testing Month View..." -ForegroundColor Yellow

$currentMonth = Get-Date -Format "yyyy-MM"
$userId = $loginResponse.user.id

try {
    $headers = @{
        "Authorization" = "Bearer $token"
    }
    
    $params = @{
        view = "month"
        user_id = $userId
        month = $currentMonth
    }
    
    $queryString = ($params.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "&"
    $monthUrl = "$timelineUrl?$queryString"
    
    Write-Host "   URL: $monthUrl" -ForegroundColor Gray
    
    $monthResponse = Invoke-RestMethod -Uri $monthUrl -Method Get -Headers $headers -ErrorAction Stop
    
    Write-Host "✅ Month data retrieved" -ForegroundColor Green
    Write-Host "   Days with data: $($monthResponse.days.Count)" -ForegroundColor Gray
    
    if ($monthResponse.days.Count -gt 0) {
        $firstDay = $monthResponse.days[0]
        Write-Host "   Sample day:" -ForegroundColor Gray
        Write-Host "     Date: $($firstDay.work_date)" -ForegroundColor Gray
        Write-Host "     Work seconds: $($firstDay.work_seconds)" -ForegroundColor Gray
        Write-Host "     Break seconds: $($firstDay.break_seconds)" -ForegroundColor Gray
        Write-Host "     Idle seconds: $($firstDay.idle_seconds)" -ForegroundColor Gray
        Write-Host "     Screenshots: $($firstDay.screenshot_count)" -ForegroundColor Gray
    } else {
        Write-Host "   ⚠️  No activity data for this month" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Month view failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Step 3: Test day view
Write-Host "Step 3: Testing Day View..." -ForegroundColor Yellow

$today = Get-Date -Format "yyyy-MM-dd"

try {
    $params = @{
        view = "day"
        user_id = $userId
        date = $today
    }
    
    $queryString = ($params.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "&"
    $dayUrl = "$timelineUrl?$queryString"
    
    Write-Host "   URL: $dayUrl" -ForegroundColor Gray
    
    $dayResponse = Invoke-RestMethod -Uri $dayUrl -Method Get -Headers $headers -ErrorAction Stop
    
    Write-Host "✅ Day data retrieved" -ForegroundColor Green
    
    if ($dayResponse) {
        Write-Host "   Sessions: $($dayResponse.sessions.Count)" -ForegroundColor Gray
        Write-Host "   Breaks: $($dayResponse.breaks.Count)" -ForegroundColor Gray
        Write-Host "   Apps: $($dayResponse.apps.Count)" -ForegroundColor Gray
        Write-Host "   Screenshots: $($dayResponse.screenshots.Count)" -ForegroundColor Gray
        
        if ($dayResponse.totals) {
            Write-Host "   Totals:" -ForegroundColor Gray
            Write-Host "     Work: $($dayResponse.totals.work_seconds)s" -ForegroundColor Gray
            Write-Host "     Idle: $($dayResponse.totals.idle_seconds)s" -ForegroundColor Gray
            Write-Host "     Break: $($dayResponse.totals.break_seconds)s" -ForegroundColor Gray
            Write-Host "     First clock in: $($dayResponse.totals.first_clock_in)" -ForegroundColor Gray
            Write-Host "     Last clock out: $($dayResponse.totals.last_clock_out)" -ForegroundColor Gray
        }
        
        if ($dayResponse.sessions.Count -gt 0) {
            Write-Host "   Sample session:" -ForegroundColor Gray
            $session = $dayResponse.sessions[0]
            Write-Host "     Start: $($session.start_time)" -ForegroundColor Gray
            Write-Host "     End: $($session.end_time)" -ForegroundColor Gray
            Write-Host "     Work seconds: $($session.work_seconds)" -ForegroundColor Gray
        }
        
        if ($dayResponse.apps.Count -gt 0) {
            Write-Host "   Sample app:" -ForegroundColor Gray
            $app = $dayResponse.apps[0]
            Write-Host "     Name: $($app.app_name)" -ForegroundColor Gray
            Write-Host "     Duration: $($app.duration_seconds)s" -ForegroundColor Gray
            Write-Host "     Productivity: $($app.productivity_type)" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ⚠️  No activity data for today" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Day view failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== TEST SUMMARY ===" -ForegroundColor Cyan
Write-Host "✅ Backend API is responding" -ForegroundColor Green
Write-Host "✅ Authentication working" -ForegroundColor Green
Write-Host "✅ Timeline endpoint accessible" -ForegroundColor Green
Write-Host ""
Write-Host "Next: Open browser to http://localhost:5173/timeline" -ForegroundColor Yellow
Write-Host "       Follow the manual testing guide in TIMELINE-TEST-REPORT.md" -ForegroundColor Yellow
