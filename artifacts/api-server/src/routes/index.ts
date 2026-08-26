import { Router, type IRouter } from "express";
import healthRouter from "./health";
import hypothesesRouter from "./hypotheses";
import analysesRouter from "./analyses";

const router: IRouter = Router();

router.use(healthRouter);
router.use(hypothesesRouter);
router.use(analysesRouter);

export default router;
