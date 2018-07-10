const React = require('react');
const D3Component = require('idyll-d3-component');
const d3 = require('d3');
const H = require('hilbert');
const Path = require('svg-path-generator');

const size = 600;

const jitter = (d, j = 20) => {
  // return d;
  return d + j * (Math.random() - 0.5);
}

const brightnessKey = 'brightness_avg_perceived';


class DRComponent extends D3Component {

  initialize(node, props) {
    this.width = node.getBoundingClientRect().width;
    this.height = window.innerHeight;

    const images = props.images.filter((d) => Math.random() > 0.5);

    const svg = this.svg = d3.select(node).append('svg');
    svg.attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .style('width', '100%')
      .style('height', 'auto')
      .style('overflow', 'visible')
      .style('box-shadow', '0px 0px 10000px transparent') // hack for overflow on chrome
      // .style('background', 'white')
      // .style('max-height', '100vh');

    this.weightKeys = Object.keys(props.weights);
    const _scaleCache = [];
    this.weightKeys.concat(['X_pca_x', 'X_pca_y', 'X_mctsne_x', 'X_mctsne_y', 'X_umap_x', 'X_umap_y']).forEach((key) => {
      _scaleCache[key] = d3.scaleLinear().domain(d3.extent(images, (d) => d[key]));
    })

    this.normalizeVar = (d, key) => {
      console.log(key);
      try {
        return _scaleCache[key](d[key]);
      } catch(e) {
        console.log(e);
        return 1;
      }
    }


    this.brightness = d3.scaleLinear().domain(d3.extent(images, (d) => d[brightnessKey])).range([0, this.height - this.height / 30]);


    const scale = 0.9;
    const HILBERT_SIZE = 4;
    const _hilbertNormalize = d3.scaleLinear().domain([0, 1]).range([0, Math.pow(HILBERT_SIZE, 4)]);
    const _hilbert = new H.Hilbert2d(HILBERT_SIZE);

    const hilbertG = svg.append('g').attr('transform', `translate(${scale / Math.pow(HILBERT_SIZE, 2) / 2 * this.width}, ${scale / Math.pow(HILBERT_SIZE, 2) / 2 * this.height})`)

    let hilbertPath = Path();
    d3.range(Math.pow(HILBERT_SIZE, 4)).forEach((i) => {
      const hilbertOut = _hilbert.xy(i);
      const cx = (hilbertOut.x / Math.pow(2, HILBERT_SIZE)) * scale * this.width + (1 - scale) / 2 * this.width;
      const cy = (hilbertOut.y / Math.pow(2, HILBERT_SIZE)) * scale * this.height + (1 - scale) / 2 * this.height;
      if (i === 0) {
        hilbertPath.moveTo(cx, cy);
      } else {
        hilbertPath.lineTo(cx, cy);
      }
    })

    const $hPath = hilbertG.append('path').attr('d', hilbertPath).attr('fill', 'none').attr('stroke', 'none').attr('stroke-width', 3);
    const hPath = $hPath.node();

    this.$hPath = $hPath;

    const _pathLength = hPath.getTotalLength();
    this.hilbert = (d) => {

      const hilbertOut = hPath.getPointAtLength(_pathLength * d);

      const scale = 0.66;
      const xOffset = scale / Math.pow(HILBERT_SIZE, 2) / 2 * this.width;
      const yOffset = scale / Math.pow(HILBERT_SIZE, 2) / 2 * this.height;
      return {
        x: xOffset + hilbertOut.x,
        y: yOffset + hilbertOut.y
      }
    }


    const $elements = svg.selectAll('.element')
      .data(images.map((d) => {
        return Object.assign({_seed: Math.random()}, d);
      }))

    const $el = $elements.enter()
        .append('g')
        .attr('transform', () => `translate(${Math.random() * this.width}, ${Math.random() * this.height})`)
        .classed('element', true);


    this.$el = $el;
    this.$elements = $elements;


    this.$images = this.$el.append("svg:image")
      .attr('x', (d) => {
        return -10;
      })
      .attr('y', (d) => {
        return -10;
      })
      .attr('width', (d) => {
        return 20;
      })
      .attr('height', (d) => {
        return 20;
      })
      .on('mouseenter', (d, i, nodes) => {
        console.log('mouseenter');
        // TODO - move node's parent to front

        d3.select(nodes[i])
        .attr('x', (d) => {
          return -1 * this.normalizeVar(d, 'Width (cm)') * this.width / 5 * 3;
        })
        .attr('y', (d) => {
          return -1 * this.normalizeVar(d, 'Height (cm)') * this.height / 5 * 3;
        })
        .attr('width', (d) => {
          return this.normalizeVar(d, 'Width (cm)') * this.width / 5 * 6;
        })
        .attr('height', (d) => {
          return this.normalizeVar(d, 'Height (cm)') * this.height / 5 * 6;
        })
      })
      .on('mouseleave', (d, i, nodes) => {
        console.log('mouseleave');
        d3.select(nodes[i])
          .attr('x', (d) => {
            return -1 * this.normalizeVar(d, 'Width (cm)') * this.width / 5 / 2;
          })
          .attr('y', (d) => {
            return -1 * this.normalizeVar(d, 'Height (cm)') * this.height / 5 / 2;
          })
          .attr('width', (d) => {
            return this.normalizeVar(d, 'Width (cm)') * this.width / 5;
          })
          .attr('height', (d) => {
            return this.normalizeVar(d, 'Height (cm)') * this.height / 5;
          })
      })
      .style('opacity', 0)
      .attr("xlink:href", (d) => `./static/images/met/${d['Object ID']}.jpg`);



    // d3.range(0, 1, 0.001).forEach((d) => {
    //   const h = this.hilbert(d);
    //   svg.append('circle')
    //     .attr('cx', h.x)
    //     .attr('cy', h.y)
    //     .attr('r', 5)
    // })
  }

  _updateHilbert(props) {
    let max = 0;
    let min = 0;
    let weights = [];
    const scale = this.weightKeys.reduce((memo, key, i) => {
      return memo + props.weights[key];
    }, 0);
    if (scale === 0) {
      return;
    }
    this.$el
      .each((d) => {

        const _weighted = this.weightKeys.reduce((memo, key, i) => {
          return memo + props.weights[key] * this.normalizeVar(d, key);
        }, 0) / scale;

        if (_weighted > max) {
          max = _weighted;
        }
        if (_weighted < min) {
          min = _weighted;
        }
        weights.push(_weighted);
      });

    console.log(max);
    this.$el
      // .transition()
      // .duration(1000)
      .attr('transform', (d, i) => {
        const { x, y } = this.hilbert((weights[i] - min) / (max - min));
        return  `translate(${jitter(x)}, ${jitter(y)})`;
      })
  }

  update(props) {
    if (props.state !== this.props.state) {
      switch(props.state) {
        case 'initial':

          console.log('initial.....');
          this.$rects = this.$el.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', 0)
            .attr('height', 0)
            .style('fill', '#feefae');

          this.$rects
            .transition()
            .duration(1000)
            // .delay(100)
            // .delay((d, i) => 100 + (i + 10) * 30 + (Math.random() - 0.5) * 30)
            .delay((d, i) => 50 + 25 * Math.random() + i * 5)
            .ease(d3.easeElasticOut)
            .attr('x', (d) => {
              return -10;
            })
            .attr('y', (d) => {
              return -10;
            })
            .attr('width', (d) => {
              return 20;
            })
            .attr('height', (d) => {
              return 20;
            })
            // .on('end', () => {
            //     // `./static/images/${d.AccessionNumber}.jpg`)
            // });

          break;

        case 'reveal':

          this.$images.style('opacity', 1);
          this.$rects
            .transition()
            .delay((d, i) => 50 + 25 * Math.random() + i * 5)
            .duration(1000)
            .style('opacity', 0)
            .on('end', function() {
              d3.select(this).remove();
            })
          break;
        case '1d':
          this.$el
              .transition()
              .duration(1000)
              .attr('transform', (d) => `translate(${jitter(this.width / 2, this.width / 2)}, ${jitter(this.brightness(d[brightnessKey]))})` );
          break;
        case 'reset':
          props.updateProps({ showHilbert: false });
          this.$el
            .transition()
            .duration(1000)
            .attr('transform', () => `translate(${Math.random() * this.width}, ${Math.random() * this.height})`)
          break;
        case 'hilbert-brightness':
          this.$el
            .transition()
            .duration(1000)
            .attr('transform', (d) => {
              const { x, y } = this.hilbert(this.normalizeVar(d, brightnessKey));
              return  `translate(${jitter(x)}, ${jitter(y)})`;
            })
          break;
        case 'hilbert-custom':
          this._updateHilbert(props);
          break;
        case 'algorithms':
          props.updateProps({ showHilbert: false });
          break;
        default:
          break;
      }
    } else if (props.state.indexOf('hilbert') > -1) {
      this._updateHilbert(props);
    } else if (props.state === 'algorithms' && props.algorithm !== this.props.algorithm) {
      this.$el
        // .transition()
        // .duration(1000)
        .attr('transform', (d) => {
          const x = this.width * this.normalizeVar(d, `X_${props.algorithm}_x`);
          const y = this.height * this.normalizeVar(d, `X_${props.algorithm}_y`);
          return  `translate(${x}, ${y})`;
        })
    }

    if (props.showHilbert !== this.props.showHilbert) {
      this.$hPath.attr('stroke', props.showHilbert ? 'black' : 'none');
    }
  }
}

module.exports = DRComponent;
