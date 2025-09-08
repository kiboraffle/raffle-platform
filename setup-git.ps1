# Setup Git Repository for Raffle Platform
# PowerShell script untuk inisialisasi Git dan GitHub setup

Write-Host "🚀 Setting up Git repository for Raffle Platform..." -ForegroundColor Green

# Check if git is installed
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Git is not installed. Please install Git first." -ForegroundColor Red
    Write-Host "Download from: https://git-scm.com/download/windows" -ForegroundColor Yellow
    exit 1
}

# Check if we're in the right directory
if (!(Test-Path "package.json")) {
    Write-Host "❌ Please run this script from the project root directory." -ForegroundColor Red
    exit 1
}

Write-Host "📁 Current directory: $(Get-Location)" -ForegroundColor Blue

# Initialize git repository if not already initialized
if (!(Test-Path ".git")) {
    Write-Host "📦 Initializing Git repository..." -ForegroundColor Yellow
    git init
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Git repository initialized successfully." -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to initialize Git repository." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "📦 Git repository already exists." -ForegroundColor Blue
}

# Configure git user if not already configured
$gitUserName = git config user.name
$gitUserEmail = git config user.email

if ([string]::IsNullOrEmpty($gitUserName)) {
    $userName = Read-Host "Enter your Git username"
    git config user.name "$userName"
    Write-Host "✅ Git username configured: $userName" -ForegroundColor Green
}

if ([string]::IsNullOrEmpty($gitUserEmail)) {
    $userEmail = Read-Host "Enter your Git email"
    git config user.email "$userEmail"
    Write-Host "✅ Git email configured: $userEmail" -ForegroundColor Green
}

# Add all files to staging
Write-Host "📝 Adding files to Git..." -ForegroundColor Yellow
git add .

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Files added to Git staging area." -ForegroundColor Green
} else {
    Write-Host "❌ Failed to add files to Git." -ForegroundColor Red
    exit 1
}

# Check if there are any changes to commit
$status = git status --porcelain
if ([string]::IsNullOrEmpty($status)) {
    Write-Host "📝 No changes to commit." -ForegroundColor Blue
} else {
    # Commit changes
    Write-Host "💾 Creating initial commit..." -ForegroundColor Yellow
    git commit -m "Initial commit: Platform Undian Digital with Supabase migration"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Initial commit created successfully." -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to create initial commit." -ForegroundColor Red
        exit 1
    }
}

# Check if remote origin exists
$remoteOrigin = git remote get-url origin 2>$null
if ([string]::IsNullOrEmpty($remoteOrigin)) {
    Write-Host "" 
    Write-Host "🔗 GitHub Repository Setup" -ForegroundColor Cyan
    Write-Host "Please follow these steps to connect to GitHub:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Go to https://github.com and create a new repository" -ForegroundColor White
    Write-Host "2. Repository name: raffle-platform (or your preferred name)" -ForegroundColor White
    Write-Host "3. Description: Platform Undian Digital Komersial dengan Supabase" -ForegroundColor White
    Write-Host "4. Set as Private repository for security" -ForegroundColor White
    Write-Host "5. Do NOT initialize with README (we already have one)" -ForegroundColor White
    Write-Host ""
    
    $repoUrl = Read-Host "Enter your GitHub repository URL (e.g., https://github.com/username/raffle-platform.git)"
    
    if (![string]::IsNullOrEmpty($repoUrl)) {
        Write-Host "🔗 Adding remote origin..." -ForegroundColor Yellow
        git remote add origin $repoUrl
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Remote origin added successfully." -ForegroundColor Green
            
            # Set main branch and push
            Write-Host "📤 Pushing to GitHub..." -ForegroundColor Yellow
            git branch -M main
            git push -u origin main
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Code pushed to GitHub successfully!" -ForegroundColor Green
                Write-Host "🌐 Repository URL: $repoUrl" -ForegroundColor Blue
            } else {
                Write-Host "❌ Failed to push to GitHub. Please check your credentials and repository URL." -ForegroundColor Red
                Write-Host "💡 You can manually push later with: git push -u origin main" -ForegroundColor Yellow
            }
        } else {
            Write-Host "❌ Failed to add remote origin." -ForegroundColor Red
        }
    }
} else {
    Write-Host "🔗 Remote origin already configured: $remoteOrigin" -ForegroundColor Blue
    
    # Push any new commits
    Write-Host "📤 Pushing to GitHub..." -ForegroundColor Yellow
    git push
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Code pushed to GitHub successfully!" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Push failed. You may need to pull first or check your credentials." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🎉 Git setup completed!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Go to https://vercel.com and create a new project" -ForegroundColor White
Write-Host "2. Import your GitHub repository" -ForegroundColor White
Write-Host "3. Configure environment variables in Vercel" -ForegroundColor White
Write-Host "4. Deploy your application" -ForegroundColor White
Write-Host ""
Write-Host "📖 For detailed deployment instructions, see DEPLOYMENT.md" -ForegroundColor Blue
Write-Host ""

# Show current git status
Write-Host "📊 Current Git Status:" -ForegroundColor Cyan
git status --short

Write-Host ""
Write-Host "🔧 Useful Git Commands:" -ForegroundColor Cyan
Write-Host "git status          - Check repository status" -ForegroundColor White
Write-Host "git add .           - Stage all changes" -ForegroundColor White
Write-Host "git commit -m 'msg' - Commit changes" -ForegroundColor White
Write-Host "git push            - Push to GitHub" -ForegroundColor White
Write-Host "git pull            - Pull from GitHub" -ForegroundColor White

Write-Host ""
Write-Host "✨ Happy coding!" -ForegroundColor Green