import * as tf from '@tensorflow/tfjs';

class L2 {
  constructor(config) {
    this.l2 = config && config.l2 ? config.l2 : 0.01;
  }

  apply(x) {
    return tf.tidy(() => {
      const sumSquares = tf.sum(tf.mul(x, x));
      return tf.mul(tf.scalar(0.5 * this.l2), sumSquares);
    });
  }

  getConfig() {
    return {
      l2: this.l2
    };
  }

  static className = 'L2';
}

tf.serialization.registerClass(L2);

export default L2;


