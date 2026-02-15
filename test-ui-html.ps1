# Automated HTML Analysis Test
# Fetches and analyzes the actual rendered HTML

$baseUrl = "http://localhost:5173"

Write-Host "=== User Monitor UI HTML Analysis ===" -ForegroundColor Cyan
Write-Host ""

# Function to fetch and analyze page
function Test-Page {
    param(
        [string]$url,
        [string]$pageName
    )
    
    Write-Host "Testing: $pageName" -ForegroundColor Yellow
    Write-Host "URL: $url" -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
        
        $html = $response.Content
        
        Write-Host "✅ Page loaded successfully (Status: $($response.StatusCode))" -ForegroundColor Green
        Write-Host "   Content-Type: $($response.Headers['Content-Type'])" -ForegroundColor Gray
        Write-Host "   Content-Length: $($html.Length) bytes" -ForegroundColor Gray
        
        # Check for React root
        if ($html -match '<div id="root">') {
            Write-Host "   ✅ React root div found" -ForegroundColor Green
        }
        
        # Check for Vite script
        if ($html -match 'type="module".*src="/src/main.jsx"') {
            Write-Host "   ✅ Vite module script found" -ForegroundColor Green
        }
        
        # Check for title
        if ($html -match '<title>(.*?)</title>') {
            Write-Host "   ✅ Page title: $($matches[1])" -ForegroundColor Green
        }
        
        # Check for meta viewport (responsive)
        if ($html -match 'name="viewport"') {
            Write-Host "   ✅ Responsive meta tag present" -ForegroundColor Green
        }
        
        Write-Host ""
        return $true
        
    } catch {
        Write-Host "❌ Failed to load page: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        return $false
    }
}

# Test all pages
Write-Host "=== Testing Frontend Pages ===" -ForegroundColor Cyan
Write-Host ""

$pages = @(
    @{url="$baseUrl/"; name="Root (/)"},
    @{url="$baseUrl/login"; name="Login Page"},
    @{url="$baseUrl/register"; name="Registration Page"}
)

$results = @()
foreach ($page in $pages) {
    $success = Test-Page -url $page.url -pageName $page.name
    $results += @{name=$page.name; success=$success}
}

# Summary
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
foreach ($result in $results) {
    if ($result.success) {
        Write-Host "✅ $($result.name)" -ForegroundColor Green
    } else {
        Write-Host "❌ $($result.name)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Manual Testing Instructions ===" -ForegroundColor Cyan
Write-Host "A browser window has been opened to: http://localhost:5173/" -ForegroundColor Yellow
Write-Host ""
Write-Host "Please perform the following manual tests:" -ForegroundColor White
Write-Host ""
Write-Host "1. VISUAL INSPECTION:" -ForegroundColor Yellow
Write-Host "   - Check if the page loads without blank screens" -ForegroundColor White
Write-Host "   - Verify forms are properly styled" -ForegroundColor White
Write-Host "   - Check if buttons are visible and styled" -ForegroundColor White
Write-Host ""
Write-Host "2. REGISTRATION TEST (navigate to /register):" -ForegroundColor Yellow
Write-Host "   - Click submit with empty form" -ForegroundColor White
Write-Host "   - Verify validation messages appear in red" -ForegroundColor White
Write-Host "   - Fill in valid data and submit" -ForegroundColor White
Write-Host ""
Write-Host "3. LOGIN TEST (navigate to /login):" -ForegroundColor Yellow
Write-Host "   - Click submit with empty form" -ForegroundColor White
Write-Host "   - Verify validation messages appear" -ForegroundColor White
Write-Host "   - Try invalid credentials" -ForegroundColor White
Write-Host ""
Write-Host "4. OPEN BROWSER CONSOLE (F12):" -ForegroundColor Yellow
Write-Host "   - Check for any red error messages" -ForegroundColor White
Write-Host "   - Check Network tab for failed requests" -ForegroundColor White
Write-Host ""
Write-Host "Browser opened at: http://localhost:5173/" -ForegroundColor Green
