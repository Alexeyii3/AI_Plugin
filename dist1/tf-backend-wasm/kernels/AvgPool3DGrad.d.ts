/**
 * @license
 * Copyright 2023 Google LLC.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
/// <amd-module name="@tensorflow/tfjs-backend-wasm/dist/kernels/AvgPool3DGrad" />
import { AvgPool3DGradAttrs, AvgPool3DGradInputs, KernelConfig, TensorInfo } from '@tensorflow/tfjs-core';
import { BackendWasm } from '../backend_wasm';
export declare function avgPool3DGrad(args: {
    inputs: AvgPool3DGradInputs;
    attrs: AvgPool3DGradAttrs;
    backend: BackendWasm;
}): TensorInfo;
export declare const avgPool3DGradConfig: KernelConfig;
