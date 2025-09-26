import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * AI Algorithm Test Runner
 * Orchestrates execution of all AI algorithm tests and generates comprehensive reports
 */
export class AIAlgorithmTestRunner {
  private testResults: TestSuiteResult[] = [];
  private startTime: number = 0;
  private endTime: number = 0;

  async runAllTests(): Promise<TestRunReport> {
    console.log('🚀 Starting AI Algorithm Test Suite...\n');
    this.startTime = Date.now();

    try {
      // Run each test suite
      await this.runTestSuite('Constraint Validation', 'ConstraintValidationTests.test.ts');
      await this.runTestSuite('Scheduling Optimization', 'SchedulingOptimizationTests.test.ts');
      await this.runTestSuite('Performance Benchmarks', 'PerformanceBenchmarks.test.ts');
      await this.runTestSuite('Edge Cases', 'EdgeCaseTests.test.ts');
      await this.runTestSuite('Load Testing', 'LoadTests.test.ts');

      this.endTime = Date.now();
      
      const report = this.generateReport();
      await this.saveReport(report);
      
      console.log('\n✅ AI Algorithm Test Suite Complete!');
      console.log(`📊 Total execution time: ${report.totalExecutionTime}ms`);
      console.log(`📈 Overall success rate: ${report.overallSuccessRate.toFixed(1)}%`);
      
      return report;
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      throw error;
    }
  }

  private async runTestSuite(name: string, filename: string): Promise<void> {
    console.log(`🧪 Running ${name} tests...`);
    
    const startTime = Date.now();
    let success = false;
    let output = '';
    let errorOutput = '';
    
    try {
      const testPath = path.join(__dirname, filename);
      
      // Run Jest for specific test file
      const command = `npx jest ${testPath} --verbose --detectOpenHandles --forceExit`;
      output = execSync(command, { 
        encoding: 'utf8',
        timeout: 300000, // 5 minute timeout
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      
      success = true;
      console.log(`✅ ${name} tests passed`);
    } catch (error: any) {
      success = false;
      errorOutput = error.stdout || error.message || 'Unknown error';
      console.log(`❌ ${name} tests failed`);
      console.log(`Error: ${error.message}`);
    }
    
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    this.testResults.push({
      suiteName: name,
      filename,
      success,
      executionTime,
      output,
      errorOutput,
      metrics: this.extractMetrics(output)
    });
    
    console.log(`⏱️  Execution time: ${executionTime}ms\n`);
  }

  private extractMetrics(output: string): TestMetrics {
    const metrics: TestMetrics = {
      testsRun: 0,
      testsPassed: 0,
      testsFailed: 0,
      averageExecutionTime: 0,
      memoryUsage: 0,
      performanceMetrics: {}
    };

    try {
      // Extract Jest test results
      const testMatch = output.match(/Tests:\s+(\d+)\s+passed(?:,\s+(\d+)\s+failed)?/);
      if (testMatch) {
        metrics.testsPassed = parseInt(testMatch[1]);
        metrics.testsFailed = parseInt(testMatch[2] || '0');
        metrics.testsRun = metrics.testsPassed + metrics.testsFailed;
      }

      // Extract performance metrics from console.log statements
      const performanceLines = output.match(/.*test:.*\d+.*ms/g) || [];
      const executionTimes: number[] = [];
      
      performanceLines.forEach(line => {
        const timeMatch = line.match(/(\d+(?:\.\d+)?)ms/);
        if (timeMatch) {
          executionTimes.push(parseFloat(timeMatch[1]));
        }
      });

      if (executionTimes.length > 0) {
        metrics.averageExecutionTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
      }

      // Extract memory usage if available
      const memoryMatch = output.match(/(\d+(?:\.\d+)?)MB/);
      if (memoryMatch) {
        metrics.memoryUsage = parseFloat(memoryMatch[1]);
      }

      // Extract specific performance metrics
      const throughputMatch = output.match(/(\d+(?:\.\d+)?)\s+req\/s/);
      if (throughputMatch) {
        metrics.performanceMetrics.throughput = parseFloat(throughputMatch[1]);
      }

      const successRateMatch = output.match /(\d+(?:\.\d+)?)%\s+success\s+rate/);
      if (successRateMatch) {
        metrics.performanceMetrics.successRate = parseFloat(successRateMatch[1]);
      }

    } catch (error) {
      console.warn('Failed to extract metrics from test output:', error);
    }

    return metrics;
  }

  private generateReport(): TestRunReport {
    const totalExecutionTime = this.endTime - this.startTime;
    const totalTests = this.testResults.reduce((sum, result) => sum + result.metrics.testsRun, 0);
    const totalPassed = this.testResults.reduce((sum, result) => sum + result.metrics.testsPassed, 0);
    const overallSuccessRate = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;

    const report: TestRunReport = {
      timestamp: new Date().toISOString(),
      totalExecutionTime,
      overallSuccessRate,
      suiteResults: this.testResults,
      summary: {
        totalSuites: this.testResults.length,
        successfulSuites: this.testResults.filter(r => r.success).length,
        failedSuites: this.testResults.filter(r => !r.success).length,
        totalTests,
        totalPassed,
        totalFailed: totalTests - totalPassed,
        averageExecutionTime: this.testResults.reduce((sum, r) => sum + r.executionTime, 0) / this.testResults.length
      },
      performanceInsights: this.generatePerformanceInsights(),
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  private generatePerformanceInsights(): PerformanceInsights {
    const insights: PerformanceInsights = {
      fastestSuite: '',
      slowestSuite: '',
      memoryEfficiency: 'good',
      scalabilityRating: 'excellent',
      bottlenecks: []
    };

    if (this.testResults.length === 0) return insights;

    // Find fastest and slowest suites
    const sortedByTime = [...this.testResults].sort((a, b) => a.executionTime - b.executionTime);
    insights.fastestSuite = sortedByTime[0].suiteName;
    insights.slowestSuite = sortedByTime[sortedByTime.length - 1].suiteName;

    // Analyze memory efficiency
    const avgMemoryUsage = this.testResults.reduce((sum, r) => sum + r.metrics.memoryUsage, 0) / this.testResults.length;
    if (avgMemoryUsage > 100) {
      insights.memoryEfficiency = 'poor';
      insights.bottlenecks.push('High memory usage detected');
    } else if (avgMemoryUsage > 50) {
      insights.memoryEfficiency = 'fair';
    }

    // Analyze scalability
    const loadTestResult = this.testResults.find(r => r.suiteName.includes('Load'));
    if (loadTestResult && !loadTestResult.success) {
      insights.scalabilityRating = 'poor';
      insights.bottlenecks.push('Load testing failures detected');
    } else if (loadTestResult && loadTestResult.executionTime > 30000) {
      insights.scalabilityRating = 'fair';
      insights.bottlenecks.push('Slow performance under load');
    }

    // Check for performance bottlenecks
    const slowSuites = this.testResults.filter(r => r.executionTime > 10000);
    if (slowSuites.length > 0) {
      insights.bottlenecks.push(`Slow test suites: ${slowSuites.map(s => s.suiteName).join(', ')}`);
    }

    return insights;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Check for failed suites
    const failedSuites = this.testResults.filter(r => !r.success);
    if (failedSuites.length > 0) {
      recommendations.push(`Fix failing test suites: ${failedSuites.map(s => s.suiteName).join(', ')}`);
    }

    // Check for performance issues
    const slowSuites = this.testResults.filter(r => r.executionTime > 15000);
    if (slowSuites.length > 0) {
      recommendations.push('Optimize performance for slow test suites');
      recommendations.push('Consider implementing caching or algorithm optimizations');
    }

    // Check memory usage
    const highMemorySuites = this.testResults.filter(r => r.metrics.memoryUsage > 50);
    if (highMemorySuites.length > 0) {
      recommendations.push('Investigate memory usage in high-consumption test suites');
      recommendations.push('Consider implementing memory pooling or garbage collection optimizations');
    }

    // Check test coverage
    const totalTests = this.testResults.reduce((sum, r) => sum + r.metrics.testsRun, 0);
    if (totalTests < 100) {
      recommendations.push('Consider adding more test cases to improve coverage');
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('All tests passing! Consider adding more edge cases and performance scenarios');
      recommendations.push('Monitor performance metrics in production environments');
    }

    return recommendations;
  }

  private async saveReport(report: TestRunReport): Promise<void> {
    const reportsDir = path.join(__dirname, '..', '..', '..', 'test-reports');
    
    // Create reports directory if it doesn't exist
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportsDir, `ai-algorithm-test-report-${timestamp}.json`);
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Also create a human-readable summary
    const summaryPath = path.join(reportsDir, `ai-algorithm-test-summary-${timestamp}.md`);
    const summaryContent = this.generateMarkdownSummary(report);
    fs.writeFileSync(summaryPath, summaryContent);
    
    console.log(`📄 Report saved to: ${reportPath}`);
    console.log(`📋 Summary saved to: ${summaryPath}`);
  }

  private generateMarkdownSummary(report: TestRunReport): string {
    return `# AI Algorithm Test Report

**Generated:** ${report.timestamp}
**Total Execution Time:** ${report.totalExecutionTime}ms
**Overall Success Rate:** ${report.overallSuccessRate.toFixed(1)}%

## Summary

- **Total Test Suites:** ${report.summary.totalSuites}
- **Successful Suites:** ${report.summary.successfulSuites}
- **Failed Suites:** ${report.summary.failedSuites}
- **Total Tests:** ${report.summary.totalTests}
- **Tests Passed:** ${report.summary.totalPassed}
- **Tests Failed:** ${report.summary.totalFailed}

## Test Suite Results

${report.suiteResults.map(suite => `
### ${suite.suiteName}
- **Status:** ${suite.success ? '✅ PASSED' : '❌ FAILED'}
- **Execution Time:** ${suite.executionTime}ms
- **Tests Run:** ${suite.metrics.testsRun}
- **Tests Passed:** ${suite.metrics.testsPassed}
- **Tests Failed:** ${suite.metrics.testsFailed}
${suite.metrics.memoryUsage > 0 ? `- **Memory Usage:** ${suite.metrics.memoryUsage}MB` : ''}
${suite.errorOutput ? `\n**Error Output:**\n\`\`\`\n${suite.errorOutput.substring(0, 500)}...\n\`\`\`` : ''}
`).join('\n')}

## Performance Insights

- **Fastest Suite:** ${report.performanceInsights.fastestSuite}
- **Slowest Suite:** ${report.performanceInsights.slowestSuite}
- **Memory Efficiency:** ${report.performanceInsights.memoryEfficiency}
- **Scalability Rating:** ${report.performanceInsights.scalabilityRating}

${report.performanceInsights.bottlenecks.length > 0 ? `
### Bottlenecks Detected
${report.performanceInsights.bottlenecks.map(b => `- ${b}`).join('\n')}
` : ''}

## Recommendations

${report.recommendations.map(r => `- ${r}`).join('\n')}

---
*Generated by AI Algorithm Test Framework*
`;
  }
}

// Type definitions
interface TestSuiteResult {
  suiteName: string;
  filename: string;
  success: boolean;
  executionTime: number;
  output: string;
  errorOutput: string;
  metrics: TestMetrics;
}

interface TestMetrics {
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  averageExecutionTime: number;
  memoryUsage: number;
  performanceMetrics: {
    throughput?: number;
    successRate?: number;
    [key: string]: any;
  };
}

interface TestRunReport {
  timestamp: string;
  totalExecutionTime: number;
  overallSuccessRate: number;
  suiteResults: TestSuiteResult[];
  summary: {
    totalSuites: number;
    successfulSuites: number;
    failedSuites: number;
    totalTests: number;
    totalPassed: number;
    totalFailed: number;
    averageExecutionTime: number;
  };
  performanceInsights: PerformanceInsights;
  recommendations: string[];
}

interface PerformanceInsights {
  fastestSuite: string;
  slowestSuite: string;
  memoryEfficiency: 'excellent' | 'good' | 'fair' | 'poor';
  scalabilityRating: 'excellent' | 'good' | 'fair' | 'poor';
  bottlenecks: string[];
}

// CLI runner
if (require.main === module) {
  const runner = new AIAlgorithmTestRunner();
  runner.runAllTests().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

export { TestRunReport, TestSuiteResult, TestMetrics, PerformanceInsights };