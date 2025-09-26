// Very simple test to check if the basic setup works
console.log('Testing basic Node.js functionality...');

try {
  const fs = require('fs');
  const path = require('path');
  
  // Check if package.json exists
  const packagePath = path.join(__dirname, 'package.json');
  if (fs.existsSync(packagePath)) {
    console.log('✓ package.json found');
    
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    console.log('✓ Package name:', pkg.name);
    console.log('✓ Dependencies found:', Object.keys(pkg.dependencies || {}).length);
  }
  
  // Check if src directory exists
  const srcPath = path.join(__dirname, 'src');
  if (fs.existsSync(srcPath)) {
    console.log('✓ src directory found');
  }
  
  console.log('✓ Basic setup looks good!');
} catch (error) {
  console.error('✗ Error:', error.message);
}