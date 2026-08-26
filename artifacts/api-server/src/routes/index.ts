import { Router, type IRouter } from "express";
import healthRouter from "./health";
import hypothesesRouter from "./hypotheses";

const router: IRouter = Router();

router.use(healthRouter);
router.use(hypothesesRouter);

export default router;
