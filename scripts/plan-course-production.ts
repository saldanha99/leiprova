import research from "../src/lib/editorial/course-source-research.json";
import {
  buildCourseProductionPlan,
  COURSE_PRODUCTION_NEXT_STEP_LABELS,
} from "../src/lib/editorial/course-production-plan";

// Planejamento determinístico. Não usa provedor pago, banco, SSH ou publicação.
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && !["--json", "--summary"].includes(args[0]))) {
  throw new Error("Use --summary ou --json. Este comando não gera nem aprova questões.");
}
const orders = buildCourseProductionPlan(research);
const summary = {
  execution: "planning_only",
  researchedAt: research.checkedAt,
  plannedCourses: orders.length,
  minimumPerCourse: 68,
  targetValidBindings: orders.length * 68,
  publicationAllowed: false,
  byNextStep: Object.entries(COURSE_PRODUCTION_NEXT_STEP_LABELS).map(([step, label]) => ({
    step, label, count: orders.filter((order) => order.nextStep === step).length,
  })),
};
console.log(JSON.stringify(args[0] === "--json" ? { ...summary, orders } : summary, null, 2));
