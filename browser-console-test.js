// Visual Testing Checklist - Complete in Browser Console
// Copy and paste this into the browser console at http://localhost:5173/

console.log('=== USER MONITOR UI VISUAL TEST ===\n');

// Test 1: Check if React app is mounted
const root = document.getElementById('root');
if (root && root.children.length > 0) {
    console.log('✅ React app is mounted');
    console.log('   Root has', root.children.length, 'child elements');
} else {
    console.error('❌ React app not mounted');
}

// Test 2: Check for forms
const forms = document.querySelectorAll('form');
console.log('\n📝 Forms found:', forms.length);
forms.forEach((form, i) => {
    console.log(`   Form ${i + 1}:`, form.querySelectorAll('input').length, 'inputs');
});

// Test 3: Check for buttons
const buttons = document.querySelectorAll('button');
console.log('\n🔘 Buttons found:', buttons.length);
buttons.forEach((btn, i) => {
    console.log(`   Button ${i + 1}:`, btn.textContent.trim());
});

// Test 4: Check for inputs
const inputs = document.querySelectorAll('input');
console.log('\n📥 Input fields found:', inputs.length);
inputs.forEach((input, i) => {
    console.log(`   Input ${i + 1}:`, {
        type: input.type,
        id: input.id,
        placeholder: input.placeholder,
        required: input.required
    });
});

// Test 5: Check for labels
const labels = document.querySelectorAll('label');
console.log('\n🏷️ Labels found:', labels.length);
labels.forEach((label, i) => {
    console.log(`   Label ${i + 1}:`, label.textContent.trim());
});

// Test 6: Check current route
console.log('\n🛣️ Current URL:', window.location.href);
console.log('   Path:', window.location.pathname);

// Test 7: Check for error messages
const errors = document.querySelectorAll('.text-red-500, [class*="error"]');
console.log('\n❌ Error elements found:', errors.length);

// Test 8: Check localStorage
console.log('\n💾 LocalStorage:');
console.log('   Token exists:', !!localStorage.getItem('token'));

// Test 9: Check page title
console.log('\n📄 Page title:', document.title);

// Test 10: Check for Cards
const cards = document.querySelectorAll('[class*="card"]');
console.log('\n🎴 Card elements found:', cards.length);

// Test 11: Get all visible text
const bodyText = document.body.innerText;
console.log('\n📃 Page contains these key phrases:');
if (bodyText.includes('Login')) console.log('   ✅ "Login" text found');
if (bodyText.includes('Register')) console.log('   ✅ "Register" text found');
if (bodyText.includes('Email')) console.log('   ✅ "Email" text found');
if (bodyText.includes('Password')) console.log('   ✅ "Password" text found');
if (bodyText.includes('Organization')) console.log('   ✅ "Organization" text found');

// Test 12: Check if Tailwind CSS is working
const testElement = document.querySelector('[class*="flex"]');
if (testElement) {
    const styles = window.getComputedStyle(testElement);
    console.log('\n🎨 Tailwind CSS check:');
    console.log('   Display:', styles.display);
    if (styles.display === 'flex') {
        console.log('   ✅ Tailwind CSS is working');
    }
}

console.log('\n=== VISUAL TEST COMPLETE ===');
console.log('\nNext: Try these manual tests:');
console.log('1. Navigate to /login and /register');
console.log('2. Submit empty forms and check for red error messages');
console.log('3. Verify buttons change text when clicked');
console.log('4. Check responsive design by resizing window');
