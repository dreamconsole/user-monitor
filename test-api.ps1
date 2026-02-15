# API Endpoint Test Script
# Testing User Monitor Backend API

$baseUrl = "http://localhost:5173"
$apiUrl = "http://localhost:3000" # Assuming backend is on 3000

Write-Host "=== User Monitor API Tests ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Check if frontend is running
Write-Host "Test 1: Frontend Status" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $baseUrl -Method Get -UseBasicParsing -TimeoutSec 5
    Write-Host "✅ Frontend is running (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "❌ Frontend is not accessible: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: Check backend health
Write-Host "Test 2: Backend Health Check" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$apiUrl/health" -Method Get -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    Write-Host "✅ Backend health endpoint: $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Backend health endpoint not found or not responding" -ForegroundColor Yellow
    Write-Host "   This is normal if no /health endpoint exists" -ForegroundColor Gray
}
Write-Host ""

# Test 3: Try to access API root
Write-Host "Test 3: API Root Access" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $apiUrl -Method Get -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    Write-Host "✅ API is accessible (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Could not access API root" -ForegroundColor Yellow
}
Write-Host ""

# Test 4: Test registration endpoint (with invalid data to check validation)
Write-Host "Test 4: Registration Endpoint Validation" -ForegroundColor Yellow
try {
    $body = @{
        orgName = ""
        email = "invalid"
        password = "123"
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "$apiUrl/api/auth/register" `
        -Method Post `
        -Body $body `
        -ContentType "application/json" `
        -UseBasicParsing `
        -TimeoutSec 5 `
        -ErrorAction Stop
        
    Write-Host "⚠️  Registration endpoint returned: $($response.StatusCode)" -ForegroundColor Yellow
} catch {
    $statusCode = $_.Exception.Response.StatusCode.Value__
    if ($statusCode -eq 400 -or $statusCode -eq 422) {
        Write-Host "✅ Registration validation is working (Status: $statusCode)" -ForegroundColor Green
        try {
            $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
            Write-Host "   Error message: $($errorResponse.error)" -ForegroundColor Gray
        } catch {
            Write-Host "   Validation error returned" -ForegroundColor Gray
        }
    } else {
        Write-Host "❌ Registration endpoint error: $($_.Exception.Message)" -ForegroundColor Red
    }
}
Write-Host ""

# Test 5: Test login endpoint (with invalid credentials)
Write-Host "Test 5: Login Endpoint Validation" -ForegroundColor Yellow
try {
    $body = @{
        email = "test@test.com"
        password = "wrongpassword"
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "$apiUrl/api/auth/login" `
        -Method Post `
        -Body $body `
        -ContentType "application/json" `
        -UseBasicParsing `
        -TimeoutSec 5 `
        -ErrorAction Stop
        
    Write-Host "⚠️  Login endpoint returned: $($response.StatusCode)" -ForegroundColor Yellow
} catch {
    $statusCode = $_.Exception.Response.StatusCode.Value__
    if ($statusCode -eq 400 -or $statusCode -eq 401) {
        Write-Host "✅ Login validation is working (Status: $statusCode)" -ForegroundColor Green
        try {
            $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
            Write-Host "   Error message: $($errorResponse.error)" -ForegroundColor Gray
        } catch {
            Write-Host "   Authentication error returned" -ForegroundColor Gray
        }
    } else {
        Write-Host "❌ Login endpoint error: $($_.Exception.Message)" -ForegroundColor Red
    }
}
Write-Host ""

# Test 6: Check if backend is running at all
Write-Host "Test 6: Backend Server Status" -ForegroundColor Yellow
$tcpClient = New-Object System.Net.Sockets.TcpClient
try {
    $tcpClient.Connect("localhost", 3000)
    Write-Host "✅ Backend server is listening on port 3000" -ForegroundColor Green
    $tcpClient.Close()
} catch {
    Write-Host "❌ Backend server is not running on port 3000" -ForegroundColor Red
    Write-Host "   Please start the backend server: npm start or node server.js" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Frontend (localhost:5173): Check above results" -ForegroundColor White
Write-Host "Backend (localhost:3000): Check above results" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Ensure backend server is running: cd server && npm start" -ForegroundColor White
Write-Host "2. Open browser to: http://localhost:5173/" -ForegroundColor White
Write-Host "3. Test registration and login manually" -ForegroundColor White
