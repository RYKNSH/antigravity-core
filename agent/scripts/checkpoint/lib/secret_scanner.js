import chalk from 'chalk';

const PATTERNS = [
    {
        name: 'OpenAI API Key',
        regex: /sk-[a-zA-Z0-9]{20,}/,
        message: 'Looks like an OpenAI API Key'
    },
    {
        name: 'AWS Access Key ID',
        regex: /AKIA[0-9A-Z]{16}/,
        message: 'Looks like an AWS Access Key'
    },
    {
        name: 'Private Key',
        regex: /-----BEGIN [A-Z]+ PRIVATE KEY-----/,
        message: 'Looks like a Private Key'
    },
    {
        name: 'Generic Secret',
        regex: /(api_key|access_token|secret)[a-z0-9_.\-]{0,25}[=:]["'\s]*[a-zA-Z0-9]{15,}/i,
        message: 'Looks like a generic API Key or Token'
    }
];

export function scanForSecrets(text) {
    const findings = [];
    
    for (const pattern of PATTERNS) {
        if (pattern.regex.test(text)) {
            findings.push(pattern);
        }
    }
    
    return findings;
}

export function printSecurityReport(findings) {
    console.log(chalk.red.bold('\n🚨 SECURITY WARNING: Potential secrets detected!'));
    findings.forEach(f => {
        console.log(chalk.yellow(`- ${f.message}`));
    });
    console.log(chalk.gray('Please remove these secrets from your instruction/commit message.\n'));
}
