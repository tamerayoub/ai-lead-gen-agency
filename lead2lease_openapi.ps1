$apiKey  = "l2l_1a434605496956a26c9126d38456cfa253fa8d6b4cc36c76"
$baseUrl = "http://localhost:5000/api/integrations/api/v1/leads"

# Build query params safely without System.Web
$params = @{
  limit = 10
}

$query = ($params.Keys | ForEach-Object {
  "{0}={1}" -f $_, [uri]::EscapeDataString([string]$params[$_])
}) -join "&"

$url = if ($query) { "$baseUrl`?$query" } else { $baseUrl }

# Print what we're about to call (this will reveal the problem)
Write-Host "BASE URL: [$baseUrl]"
Write-Host "QUERY:    [$query]"
Write-Host "FINAL:    [$url]"

# Validate URL parsing before calling
try {
  $uriObj = [uri]$url
  Write-Host "Parsed URI OK: $($uriObj.AbsoluteUri)"
} catch {
  Write-Error "URI parse failed. Raw URL was: [$url]"
  throw
}

$headers = @{
  Authorization = "Bearer $apiKey"
}

$response = Invoke-RestMethod -Method GET -Uri $url -Headers $headers

$response | ConvertTo-Json -Depth 10
