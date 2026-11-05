<?php

declare(strict_types=1);

use Dejavu\BackendClient;
use Dejavu\OrderActivities;
use Dejavu\OrderWorkflow;
use Temporal\WorkerFactory;

ini_set('display_errors', 'stderr');
require __DIR__ . '/vendor/autoload.php';

$taskQueue = getenv('TEMPORAL_TASK_QUEUE') ?: 'dejavu-tacos';
$backendUrl = getenv('DEJAVU_BACKEND_URL') ?: 'http://localhost:8000';

// RoadRunner owns the connection to Temporal (see .rr.yaml) and runs this script
// as its PHP worker pool.
$factory = WorkerFactory::create();
$worker = $factory->newWorker($taskQueue);
$worker->registerWorkflowTypes(OrderWorkflow::class);
$worker->registerActivity(
    OrderActivities::class,
    static fn () => new OrderActivities(new BackendClient($backendUrl)),
);

fwrite(STDERR, "PHP worker started, listening on task queue: {$taskQueue}\n");
$factory->run();
