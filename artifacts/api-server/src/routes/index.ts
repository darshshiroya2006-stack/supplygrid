import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import productsRouter from "./products";
import customersRouter from "./customers";
import ordersRouter from "./orders";
import inquiriesRouter from "./inquiries";
import stockRouter from "./stock";
import dashboardRouter from "./dashboard";
import storageRouter from "./storage";
import wholesalerRouter from "./wholesaler";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/products", productsRouter);
router.use("/customers", customersRouter);
router.use("/orders", ordersRouter);
router.use("/inquiries", inquiriesRouter);
router.use("/stock", stockRouter);
router.use("/dashboard", dashboardRouter);
router.use("/wholesaler", wholesalerRouter);
router.use(storageRouter);

export default router;
