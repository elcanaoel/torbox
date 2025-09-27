const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const CleanCSS = require('clean-css');

// Create dist directory
const distDir = path.join(__dirname, 'dist');
const publicDir = path.join(__dirname, 'public');

if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Minify JavaScript
async function minifyJS() {
    console.log('Minifying JavaScript...');
    
    const jsFile = path.join(publicDir, 'script.js');
    const jsContent = fs.readFileSync(jsFile, 'utf8');
    
    const result = await minify(jsContent, {
        compress: true,
        mangle: true,
        format: {
            comments: false
        }
    });
    
    if (result.error) {
        console.error('JS minification error:', result.error);
        return;
    }
    
    // Copy to dist
    fs.writeFileSync(path.join(distDir, 'script.min.js'), result.code);
    console.log('✓ JavaScript minified');
}

// Minify CSS
function minifyCSS() {
    console.log('Minifying CSS...');
    
    const cssFile = path.join(publicDir, 'style.css');
    const cssContent = fs.readFileSync(cssFile, 'utf8');
    
    const cleanCSS = new CleanCSS({
        level: 2,
        format: 'beautify'
    });
    
    const result = cleanCSS.minify(cssContent);
    
    if (result.errors.length > 0) {
        console.error('CSS minification errors:', result.errors);
        return;
    }
    
    // Copy to dist
    fs.writeFileSync(path.join(distDir, 'style.min.css'), result.styles);
    console.log('✓ CSS minified');
}

// Copy HTML with minified asset references
function copyHTML() {
    console.log('Processing HTML...');
    
    const htmlFile = path.join(publicDir, 'index.html');
    let htmlContent = fs.readFileSync(htmlFile, 'utf8');
    
    // Replace asset references with minified versions
    htmlContent = htmlContent.replace('script.js', 'script.min.js');
    htmlContent = htmlContent.replace('style.css', 'style.min.css');
    
    // Copy to dist
    fs.writeFileSync(path.join(distDir, 'index.html'), htmlContent);
    console.log('✓ HTML processed');
}

// Copy server file
function copyServer() {
    console.log('Copying server files...');
    
    const serverFile = path.join(__dirname, 'server.js');
    const packageFile = path.join(__dirname, 'package.json');
    const readmeFile = path.join(__dirname, 'README.md');
    
    fs.copyFileSync(serverFile, path.join(distDir, 'server.js'));
    fs.copyFileSync(packageFile, path.join(distDir, 'package.json'));
    fs.copyFileSync(readmeFile, path.join(distDir, 'README.md'));
    
    console.log('✓ Server files copied');
}

// Main build function
async function build() {
    console.log('🚀 Starting TorBox build process...\n');
    
    try {
        await minifyJS();
        minifyCSS();
        copyHTML();
        copyServer();
        
        console.log('\n✅ Build complete!');
        console.log('📁 Output directory: dist/');
        console.log('🚀 Run with: npm start');
        
    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

// Run build
build();
